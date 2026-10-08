/**
 * «Le mie richieste».
 *
 * Due compiti in un solo file: elencare le richieste di chi guarda (GET) e
 * creare una richiesta vera a partire dal carrello (POST). L'azione vive qui
 * anche se chi la chiama sta fisicamente sul catalogo — il dialogo di
 * richiesta manda un `fetcher.Form` a `/requests`.
 */

import { Link } from "react-router";
import type { Route } from "./+types/requests";
import { PageShell } from "~/components/page";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { fullLabelOf } from "~/lib/person";
import {
  formatDay,
  MAX_ORDINARY_SPAN_DAYS,
  MAX_SPECIAL_SPAN_DAYS,
  parseDay,
  todayUtc,
} from "~/lib/availability.server";
import { notifyLenderNewRequest } from "~/lib/marketplace-notifications.server";
import { publishLendingChange } from "~/lib/events.server";
import { parseCartItems } from "~/lib/marketplace";
import { submitRequestBatch, SubmissionError } from "~/lib/request-submission.server";
import { notifyAdminsNewRequest } from "~/lib/notifications.server";
import { unreadForUserIds } from "~/lib/inbox.server";
import { publishAdminChange } from "~/lib/events.server";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
import { useFormatDay, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "requests.heading") }];
}


export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  /* Quali hanno una risposta che non ho ancora letto. Fino a ieri non c'era
     **nessun** segnale che un admin avesse scritto: bisognava aprire le
     proprie richieste una per una per scoprirlo, ed è lo stesso difetto che
     dall'altra parte ha fatto nascere il Centro. */
  const unread = new Set(await unreadForUserIds(user.id));

  const requests = await db.request.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      purpose: true,
      items: {
        select: { asset: { select: { name: true } } },
      },
    },
  });

  return {
    requests: requests.map((r) => ({
      id: r.id,
      startDate: formatDay(r.startDate),
      endDate: formatDay(r.endDate),
      status: r.status,
      purpose: r.purpose,
      hasUnread: unread.has(r.id),
      itemNames: r.items.map((item) => item.asset.name),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const items = parseCartItems(String(form.get("items") ?? "[]"));
  if (!items) return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
  const submissionKey = String(form.get("submissionKey") ?? "");
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(submissionKey)) return { ok: false as const, error: "p2p.errorRetry" as TranslationKey };

  if (items.length === 0) {
    return { ok: false as const, error: "request.errorEmpty" as TranslationKey };
  }

  const from = parseDay(String(form.get("from") ?? ""));
  const to = parseDay(String(form.get("to") ?? ""));
  const longer = form.get("longer") === "1";
  // Tagliato qui e non solo nel browser: `maxLength` è un suggerimento che
  // un `curl` ignora, e questa è l'unica colonna di testo libero senza
  // tetto proprio. Stessa regola già applicata al corpo dei messaggi.
  const purpose = String(form.get("purpose") ?? "").trim().slice(0, 2000);
  const today = todayUtc();

  if (!from || !to || from < today || to < from) {
    return { ok: false as const, error: "request.errorDates" as TranslationKey };
  }

  const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  if (!longer && spanDays > MAX_ORDINARY_SPAN_DAYS) {
    return { ok: false as const, error: "request.errorSpan" as TranslationKey };
  }
  if (longer && purpose.length === 0) {
    return { ok: false as const, error: "request.errorPurposeRequired" as TranslationKey };
  }
  if (spanDays > MAX_SPECIAL_SPAN_DAYS) {
    return { ok: false as const, error: "request.errorSpan" as TranslationKey };
  }

  try {
    const batch = await submitRequestBatch({ userId: user.id, submissionKey, items, from, to, purpose });
    if (!batch.reused) {
      publishAdminChange();
      for (const created of batch.requests) {
        const summary = { requestId: created.id, requesterName: fullLabelOf(user), requesterEmail: user.email,
          itemNames: created.items.map((i) => i.asset.name), startDate: from, endDate: to, purpose: purpose || null, origin: new URL(request.url).origin };
        if (created.lenderId) {
          publishLendingChange(created.lenderId);
          await notifyLenderNewRequest(created.lenderId, summary);
        } else {
          await notifyAdminsNewRequest(summary).catch((error) => console.error("Notifica di richiesta fallita:", error));
        }
      }
    }
    return { ok: true as const, batchId: batch.batchId, requestIds: batch.requests.map((r) => r.id) };
  } catch (error) {
    if (error instanceof SubmissionError) return { ok: false as const, error: error.key, conflicts: error.conflicts };
    console.error("Creazione del lotto fallita:", error);
    return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
  }
}

export default function MyRequests({ loaderData }: Route.ComponentProps) {
  const { requests } = loaderData;
  const t = useT();
  const formatDayLabel = useFormatDay();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("requests.heading")}
        </h1>

        {requests.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("requests.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className="block rounded-sm border border-rule bg-card p-4 hover:border-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="eyebrow">
                      {formatDayLabel(r.startDate)} — {formatDayLabel(r.endDate)}
                    </span>
                    <span className="flex items-center gap-2">
                      {/* Prima dello stato, non dopo: «c'è una risposta» è ciò
                          che fa aprire la riga, lo stato è ciò che si legge
                          una volta dentro. */}
                      {r.hasUnread && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider text-accent">
                          {t("nav.myRequestsUnread")}
                        </span>
                      )}
                      <span className="rounded-full bg-sunk px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider text-muted">
                        {t(REQUEST_STATUS_LABELS[r.status])}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{r.itemNames.join(" · ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </main>
  );
}
