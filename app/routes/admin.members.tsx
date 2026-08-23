/**
 * I soci, per gli admin.
 *
 * Due azioni soltanto: cambiare ruolo e mandare un link per impostare la
 * password. Niente di più — creare o sospendere account non è stato
 * chiesto, e ogni pulsante in più è un pulsante da proteggere e spiegare.
 */

import { useFetcher } from "react-router";
import type { Route } from "./+types/admin.members";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { Avatar, PersonName } from "~/components/person";
import { db } from "~/lib/db.server";
import { auth } from "~/lib/auth.server";
import { requireAdmin } from "~/lib/session.server";
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
      isMember: true,
    },
  });

  return { users, currentUserId: admin.id };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const targetId = String(form.get("userId") ?? "");

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true },
  });
  if (!target) {
    return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
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

    await db.user.update({
      where: { id: target.id },
      data: { role: target.role === "ADMIN" ? "MEMBER" : "ADMIN" },
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
    return { ok: true as const, intent };
  }

  return { ok: false as const, error: "members.errorGeneric" as TranslationKey };
}

export default function AdminMembers({ loaderData }: Route.ComponentProps) {
  const { users, currentUserId } = loaderData;
  const t = useT();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("members.heading")}
        </h1>

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

function MemberRow({ user, isSelf }: { user: MemberRow; isSelf: boolean }) {
  const t = useT();
  const roleFetcher = useFetcher<typeof action>();
  const resetFetcher = useFetcher<typeof action>();
  const isAdmin = user.role === "ADMIN";

  return (
    <li className="rounded border border-rule bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Avatar person={user} size="md" />
        <PersonName person={user} className="font-medium" />
        {isAdmin && <AdminBadge />}
        <span className="text-sm text-muted">{user.email}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <roleFetcher.Form
          method="post"
          onSubmit={(event) => {
            if (!window.confirm(t("members.confirmToggle"))) {
              event.preventDefault();
            }
          }}
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

        <resetFetcher.Form
          method="post"
          onSubmit={(event) => {
            if (
              !window.confirm(t("members.confirmResetStep1")) ||
              !window.confirm(t("members.confirmResetStep2"))
            ) {
              event.preventDefault();
            }
          }}
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
    </li>
  );
}
