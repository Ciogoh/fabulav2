/**
 * I soci, per gli admin.
 *
 * Ruoli, destinatari degli avvisi operativi e link per impostare la password.
 * Essere admin e ricevere gli avvisi sono due scelte indipendenti.
 */

import { useFetcher } from "react-router";
import type { Route } from "./+types/admin.members";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { useConfirm } from "~/components/confirm";
import { pageTitle } from "~/i18n/meta";
import { Avatar, PersonName } from "~/components/person";
import { db } from "~/lib/db.server";
import { auth } from "~/lib/auth.server";
import { requireAdmin } from "~/lib/session.server";
import { logAdminAction } from "~/lib/audit.server";
import { selectAdminNotificationRecipients } from "~/lib/admin-notifications";
import { fullLabelOf } from "~/lib/person";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { AdminBadge } from "~/components/admin-badge";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "members.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireAdmin(request);

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      alias: true,
      image: true,
      email: true,
      role: true,
      receivesAdminNotifications: true,
      isMember: true,
    },
  });

  return {
    users,
    currentUserId: admin.id,
    extraEmails: selectAdminNotificationRecipients(
      users.filter((user) => user.role === "ADMIN"),
      process.env.ADMIN_EMAILS ?? "",
    ).extras,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const targetId = String(form.get("userId") ?? "");

  const target = await db.user.findUnique({
    where: { id: targetId },
    // Nome e alias servono solo alla riga del registro, che deve restare
    // leggibile anche se un domani questo account non c'è più.
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      firstName: true,
      lastName: true,
      alias: true,
    },
  });
  if (!target) {
    return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
  }

  if (intent === "setAdminNotifications") {
    const enabled = form.get("enabled");
    if (target.role !== "ADMIN" || (enabled !== "true" && enabled !== "false")) {
      return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
    }

    try {
      // Il valore è esplicito, non un toggle sul database: un doppio invio
      // deve salvare la stessa scelta. Il ruolo viene ricontrollato al write.
      const result = await db.user.updateMany({
        where: { id: target.id, role: "ADMIN" },
        data: { receivesAdminNotifications: enabled === "true" },
      });
      if (result.count !== 1) {
        return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
      }
    } catch (error) {
      console.error("Salvataggio destinatario avvisi fallito:", error);
      return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
    }

    await logAdminAction({
      actorId: admin.id,
      action: "member.notificationsChanged",
      targetType: "User",
      targetId: target.id,
      detail: `${fullLabelOf(target)} — admin notifications ${enabled === "true" ? "on" : "off"}`,
    });
    return { ok: true as const, intent };
  }

  if (intent === "toggleRole") {
    if (target.id === admin.id) {
      return { ok: false as const, error: "members.errorSelf" as TranslationKey };
    }

    if (target.role === "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return { ok: false as const, error: "members.errorLastAdmin" as TranslationKey };
      }
    }

    const nextRole = target.role === "ADMIN" ? "MEMBER" : "ADMIN";
    await db.user.update({
      where: { id: target.id },
      // Una nuova nomina richiede una scelta esplicita dei destinatari.
      // Togliendo il ruolo si cancella anche la vecchia iscrizione.
      data: { role: nextRole, receivesAdminNotifications: false },
    });

    await logAdminAction({
      actorId: admin.id,
      action: "member.roleChanged",
      targetType: "User",
      targetId: target.id,
      detail: `${fullLabelOf(target)} — ${target.role} → ${nextRole}`,
    });

    return { ok: true as const, intent };
  }

  if (intent === "sendReset") {
    try {
      await auth.api.requestPasswordReset({
        body: {
          email: target.email,
          redirectTo: `${new URL(request.url).origin}/reset-password`,
        },
      });
    } catch (error) {
      console.error("Invio link di reset fallito:", error);
      return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
    }

    // Un link che permette di entrare nell'account di un altro: è
    // esattamente il genere di azione per cui il registro esiste.
    await logAdminAction({
      actorId: admin.id,
      action: "member.resetSent",
      targetType: "User",
      targetId: target.id,
      detail: fullLabelOf(target),
    });

    return { ok: true as const, intent };
  }

  return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
}

export default function AdminMembers({ loaderData }: Route.ComponentProps) {
  const { users, currentUserId, extraEmails } = loaderData;
  const admins = users.filter((user) => user.role === "ADMIN");
  const recipientCount = admins.filter((user) => user.receivesAdminNotifications).length;
  const t = useT();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("members.heading")}
        </h1>

        <section className="mt-6 rounded-sm border border-rule bg-card p-4" aria-labelledby="admin-email-heading">
          <h2 id="admin-email-heading" className="font-serif text-xl font-semibold">
            {t("members.notificationsHeading")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("members.notificationsIntro")}</p>
          <p className="mt-3 text-sm font-medium">
            {t("members.notificationsCount", { count: recipientCount, total: admins.length })}
          </p>
          {recipientCount === 0 && (
            <p className="mt-1 text-sm text-muted">{t("members.notificationsNone")}</p>
          )}
          <ul className="mt-3 divide-y divide-rule">
            {admins.map((user) => <NotificationRecipientRow key={user.id} user={user} />)}
          </ul>
          {extraEmails.length > 0 && (
            <div className="mt-3 border-t border-rule pt-3 text-sm text-muted">
              <p>{t("members.notificationsExtras")}</p>
              <ul className="mt-1">
                {extraEmails.map((email, index) => <li key={`${email}-${index}`} className="break-all">{email}</li>)}
              </ul>
            </div>
          )}
        </section>

        {users.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("members.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {users.map((user) => (
              <MemberRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
              />
            ))}
          </ul>
        )}
      </PageShell>
    </main>
  );
}

type MemberRow = Route.ComponentProps["loaderData"]["users"][number];

function NotificationRecipientRow({ user }: { user: MemberRow }) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const enabled = busy && fetcher.formData
    ? fetcher.formData.get("enabled") === "true"
    : user.receivesAdminNotifications;

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <PersonName person={user} className="font-medium" />
        <p className="break-all text-sm text-muted">{user.email}</p>
      </div>
      <div className="shrink-0 text-right">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="setAdminNotifications" />
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="enabled" value={String(!enabled)} />
          <button
            type="submit"
            role="switch"
            aria-checked={enabled}
            aria-label={t("members.notificationsLabel", { name: fullLabelOf(user) })}
            disabled={busy}
            className="flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-sm px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60"
          >
            <span className="text-sm">{t(enabled ? "members.notificationsOn" : "members.notificationsOff")}</span>
            <span aria-hidden="true" className={`inline-flex h-6 w-11 items-center rounded-full border p-0.5 ${enabled ? "border-ink bg-ink" : "border-muted bg-paper"}`}>
              <span className={`h-4 w-4 rounded-full ${enabled ? "translate-x-5 bg-paper" : "bg-muted"}`} />
            </span>
          </button>
        </fetcher.Form>
        <p role="status" className="min-h-5 text-xs text-muted">
          {busy ? t("members.notificationsSaving") : fetcher.data?.ok ? t("account.saved") : ""}
        </p>
        {!busy && fetcher.data && !fetcher.data.ok && (
          <p role="alert" className="max-w-40 text-sm text-out">{t(fetcher.data.error)}</p>
        )}
      </div>
    </li>
  );
}

function MemberRow({ user, isSelf }: { user: MemberRow; isSelf: boolean }) {
  const t = useT();
  const roleFetcher = useFetcher<typeof action>();
  const resetFetcher = useFetcher<typeof action>();
  const isAdmin = user.role === "ADMIN";
  const confirm = useConfirm();

  return (
    <li className="rounded-sm border border-rule bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Avatar person={user} size="md" />
        <PersonName person={user} className="font-medium" />
        {isAdmin && <AdminBadge />}
        <span className="text-sm text-muted">{user.email}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <roleFetcher.Form
          method="post"
          onSubmit={confirm.ask({
            title: t("members.confirmToggle"),
            confirmLabel: isAdmin ? t("members.removeAdmin") : t("members.makeAdmin"),
            tone: isAdmin ? "danger" : "primary",
          })}
        >
          <input type="hidden" name="intent" value="toggleRole" />
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            disabled={isSelf || roleFetcher.state !== "idle"}
            className={buttonClass("quiet", "sm")}
          >
            {isAdmin ? t("members.removeAdmin") : t("members.makeAdmin")}
          </button>
        </roleFetcher.Form>

        {/* Erano due finestre di sistema in fila. Due domande consecutive non
            fanno leggere di più: fanno premere «OK» due volte senza guardare.
            La seconda diceva la conseguenza, ed è esattamente ciò che qui sta
            sotto alla domanda, dove si legge insieme e non dopo. */}
        <resetFetcher.Form
          method="post"
          onSubmit={confirm.ask({
            title: t("members.confirmResetStep1"),
            body: t("members.confirmResetStep2"),
            confirmLabel: t("members.sendReset"),
            tone: "primary",
          })}
        >
          <input type="hidden" name="intent" value="sendReset" />
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            disabled={resetFetcher.state !== "idle"}
            className={buttonClass("quiet", "sm")}
          >
            {t("members.sendReset")}
          </button>
        </resetFetcher.Form>

        {resetFetcher.state === "idle" && resetFetcher.data?.ok && (
          <span className="text-sm text-muted">{t("members.resetSent")}</span>
        )}
        {roleFetcher.data && !roleFetcher.data.ok && (
          <span className="text-sm text-out">{t(roleFetcher.data.error)}</span>
        )}
        {resetFetcher.data && !resetFetcher.data.ok && (
          <span className="text-sm text-out">{t(resetFetcher.data.error)}</span>
        )}
      </div>

      {confirm.dialog}
    </li>
  );
}
