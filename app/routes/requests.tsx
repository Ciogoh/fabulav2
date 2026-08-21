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
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import {
  formatDay,
  getBusyAssetIds,
  parseDay,
  todayUtc,
} from "~/lib/availability.server";
import { adminEmails, sendEmail } from "~/lib/email.server";
import { useFormatDay, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import type { RequestStatus } from "~/generated/prisma/enums";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

/** Un giorno di libertà oltre i sette per una richiesta ordinaria: 7 giorni
 * interi vuol dire una differenza di 6 fra inizio e fine. */
const MAX_ORDINARY_SPAN_DAYS = 7;
/** Tetto anche per le richieste speciali: contro input assurdi, non contro
 * richieste legittime — nessuna associazione presta qualcosa per un anno. */
const MAX_SPECIAL_SPAN_DAYS = 90;

type CartItemInput = { assetId: string; fromKitId?: string };

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

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
      itemNames: r.items.map((item) => item.asset.name),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  let items: CartItemInput[];
  try {
    const parsed: unknown = JSON.parse(String(form.get("items") ?? "[]"));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    items = parsed
      .filter(
        (entry): entry is CartItemInput =>
          Boolean(entry) && typeof (entry as CartItemInput).assetId === "string"
      )
      .map((entry) => ({
        assetId: entry.assetId,
        fromKitId: typeof entry.fromKitId === "string" ? entry.fromKitId : undefined,
      }));
  } catch {
    return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
  }

  if (items.length === 0) {
    return { ok: false as const, error: "request.errorEmpty" as TranslationKey };
  }

  const from = parseDay(String(form.get("from") ?? ""));
  const to = parseDay(String(form.get("to") ?? ""));
  const longer = form.get("longer") === "1";
  const purpose = String(form.get("purpose") ?? "").trim();
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

  const assetIds = items.map((item) => item.assetId);
  const assets = await db.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, name: true, isBookable: true },
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const missingOrNotBookable = assetIds.filter(
    (id) => !assetById.get(id)?.isBookable
  );
  if (missingOrNotBookable.length > 0) {
    return { ok: false as const, error: "request.errorUnavailable" as TranslationKey };
  }

  const busy = await getBusyAssetIds(from, to);
  const conflicts = assetIds
    .filter((id) => busy.has(id))
    .map((id) => assetById.get(id)!.name);

  if (conflicts.length > 0) {
    return {
      ok: false as const,
      error: "request.errorConflict" as TranslationKey,
      conflicts,
    };
  }

  const created = await db.request.create({
    data: {
      userId: user.id,
      startDate: from,
      endDate: to,
      purpose: purpose || null,
      items: {
        create: items.map((item) => ({
          assetId: item.assetId,
          fromKitId: item.fromKitId ?? null,
        })),
      },
    },
    select: { id: true },
  });

  try {
    const admins = adminEmails();
    if (admins.length > 0) {
      const names = assetIds.map((id) => assetById.get(id)!.name).join(", ");
      await Promise.all(
        admins.map((adminEmail) =>
          sendEmail({
            to: adminEmail,
            subject: `Fabula: nuova richiesta da ${user.name}`,
            text:
              `${user.name} (${user.email}) ha richiesto: ${names}\n` +
              `Dal ${formatDay(from)} al ${formatDay(to)}.\n` +
              (purpose ? `Motivo: ${purpose}\n` : "") +
              `\n${new URL(request.url).origin}/requests/${created.id}`,
          })
        )
      );
    }
  } catch (error) {
    // Un'email che non parte non deve invalidare una richiesta già scritta
    // sul database: chi l'ha fatta la vede comunque tra le sue.
    console.error("Notifica email agli admin fallita:", error);
  }

  return { ok: true as const, id: created.id };
}

const STATUS_LABELS: Record<RequestStatus, TranslationKey> = {
  PENDING: "requests.status.pending",
  APPROVED: "requests.status.approved",
  REJECTED: "requests.status.rejected",
  CANCELLED: "requests.status.cancelled",
};

export default function MyRequests({ loaderData }: Route.ComponentProps) {
  const { requests } = loaderData;
  const t = useT();
  const formatDayLabel = useFormatDay();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-8">
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
                className="block rounded border border-rule bg-card p-4 hover:border-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[0.68rem] uppercase tracking-widest text-faint">
                    {formatDayLabel(r.startDate)} — {formatDayLabel(r.endDate)}
                  </span>
                  <span className="rounded-full bg-sunk px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-muted">
                    {t(STATUS_LABELS[r.status])}
                  </span>
                </div>
                <p className="mt-2 text-sm">{r.itemNames.join(" · ")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
