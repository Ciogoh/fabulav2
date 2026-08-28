/**
 * La consegna diretta: si scansiona l'adesivo di un oggetto, si sceglie a chi
 * darlo e fino a quando, ed è fatta.
 *
 * **Non è un percorso parallelo a quello delle richieste, è lo stesso
 * percorso preso più avanti.** Quello che nasce qui è una `Request` normale,
 * già `APPROVED` (da chi sta consegnando) con il suo `RequestItem` già
 * `pickedUpAt`: esattamente lo stato in cui una richiesta ordinaria arriva
 * dopo tre passaggi, invece che dopo uno. Da lì in avanti chat, riconsegna,
 * promemoria automatico e storico funzionano già, senza una riga in più —
 * ed è il motivo per cui questa funzione non ha richiesto nessuna tabella
 * nuova.
 *
 * Due regole del percorso ordinario **non** valgono qui, e vale la pena dire
 * perché:
 *
 * - **Niente tetto di sette giorni né motivo obbligatorio.** Quel tetto
 *   esiste per frenare l'autoservizio dei soci; qui c'è un admin con la
 *   persona davanti che ha già deciso. Resta il tetto assoluto
 *   (`MAX_SPECIAL_SPAN_DAYS`), che è una difesa contro il dito storto, non
 *   contro l'abuso.
 * - **Il controllo di sovrapposizione invece resta, senza eccezioni.** Un
 *   oggetto è uno: se è già impegnato in quelle date, non si consegna due
 *   volte, e non importa chi lo sta facendo. È la sola cosa che il database
 *   non può rimediare da solo dopo.
 */

import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/admin.handover.$assetId";
import { PageShell } from "~/components/page";
import { ButtonLink, buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { logAdminAction } from "~/lib/audit.server";
import { notifyDirectHandover } from "~/lib/notifications.server";
import { publishAdminChange } from "~/lib/events.server";
import { fullLabelOf } from "~/lib/person";
import {
  formatDay,
  getBusyAssetIds,
  MAX_SPECIAL_SPAN_DAYS,
  parseDay,
  todayUtc,
} from "~/lib/availability.server";
import { DateRangeFields } from "~/components/date-range-fields";
import { PersonPicker } from "~/components/person-picker";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "handover.heading") }];
}

async function loadAsset(assetId: string) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      name: true,
      isBookable: true,
      archivedAt: true,
      location: true,
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { thumbUrl: true } },
    },
  });

  /* Un adesivo sopravvive all'oggetto: quello archiviato resta in magazzino
     con la sua etichetta addosso finché qualcuno non la stacca. Meglio un 404
     netto che un modulo che si compila e poi rifiuta di salvare. */
  if (!asset || asset.archivedAt) throw new Response("Not found", { status: 404 });
  return asset;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);

  const [asset, people] = await Promise.all([
    loadAsset(params.assetId),
    /* **Senza `image`, di proposito.** Questa pagina carica *tutti* gli
       account in una volta perché il selettore filtra nel browser, e chi
       entra con Microsoft ha in `image` la foto vera scritta in linea come
       `data:image/jpeg;base64,…`, non un indirizzo (vedi il capitolo
       sull'accesso). Con qualche centinaio di soci sarebbero megabyte di
       risposta — su un telefono, in magazzino, sulla rete della sede.
       `Avatar` ripiega da solo sulle iniziali, che qui bastano: accanto ci
       sono già nome e indirizzo email. */
    db.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        alias: true,
        email: true,
      },
    }),
  ]);

  const today = formatDay(todayUtc());

  return {
    asset: {
      id: asset.id,
      name: asset.name,
      isBookable: asset.isBookable,
      location: asset.location,
      thumbUrl: asset.photos[0]?.thumbUrl ?? null,
    },
    people,
    today,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const asset = await loadAsset(params.assetId);
  const form = await request.formData();

  const userId = String(form.get("userId") ?? "");
  const recipient = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, firstName: true, lastName: true, alias: true },
  });
  if (!recipient) {
    return { ok: false as const, error: "handover.errorNoPerson" as TranslationKey };
  }

  const from = parseDay(String(form.get("from") ?? ""));
  const to = parseDay(String(form.get("to") ?? ""));
  const purpose = String(form.get("purpose") ?? "").trim().slice(0, 500);
  const today = todayUtc();

  if (!from || !to || from < today || to < from) {
    return { ok: false as const, error: "request.errorDates" as TranslationKey };
  }

  const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (spanDays > MAX_SPECIAL_SPAN_DAYS) {
    return { ok: false as const, error: "request.errorSpan" as TranslationKey };
  }

  /* «Non prestabile» vale anche qui: è lo stato di un oggetto in riparazione,
     e consegnarlo lo stesso vorrebbe dire ignorare l'unica bandiera che
     qualcuno ha alzato apposta. */
  if (!asset.isBookable) {
    return { ok: false as const, error: "request.errorUnavailable" as TranslationKey };
  }

  const busy = await getBusyAssetIds(from, to);
  if (busy.has(asset.id)) {
    return { ok: false as const, error: "request.errorConflict" as TranslationKey };
  }

  const now = new Date();

  /* Approvata e ritirata nello stesso istante, in una transazione sola: se la
     riga del passaggio di mano non venisse scritta, resterebbe una richiesta
     approvata che nessuno ha mai chiesto e che nessuno ha in mano. */
  const created = await db.request.create({
    data: {
      userId: recipient.id,
      startDate: from,
      endDate: to,
      status: "APPROVED",
      purpose: purpose || null,
      decidedAt: now,
      decidedById: admin.id,
      items: { create: [{ assetId: asset.id, pickedUpAt: now }] },
    },
    select: { id: true },
  });

  await logAdminAction({
    actorId: admin.id,
    action: "asset.handover",
    targetType: "Request",
    targetId: created.id,
    detail: `${asset.name} → ${fullLabelOf(recipient)} (${formatDay(from)} → ${formatDay(to)})`,
  });

  /* Una consegna diretta nasce già approvata e già ritirata: nel Centro
     compare fra le cose che torneranno, e chi ha un'altra scheda aperta lo
     vede senza ricaricare. */
  publishAdminChange();

  try {
    await notifyDirectHandover({
      to: recipient.email,
      name: fullLabelOf(recipient),
      itemNames: [asset.name],
      startDate: from,
      endDate: to,
      requestId: created.id,
      origin: new URL(request.url).origin,
    });
  } catch (error) {
    // Come ovunque: una email che non parte non annulla una consegna già
    // avvenuta. L'oggetto è fisicamente nelle mani di chi l'ha ritirato.
    console.error("Notifica di consegna diretta fallita:", error);
  }

  return { ok: true as const, requestId: created.id, name: fullLabelOf(recipient) };
}

export default function Handover({ loaderData, actionData }: Route.ComponentProps) {
  const { asset, people, today } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [purpose, setPurpose] = useState("");

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-sunk">
            {asset.thumbUrl && (
              <img src={asset.thumbUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{asset.name}</h1>
            {asset.location && (
              <p className="truncate text-sm text-muted">{asset.location}</p>
            )}
          </div>
        </div>

        {actionData?.ok ? (
          /* A consegna avvenuta il modulo sparisce del tutto. Lasciarlo lì
             compilato invita a premere di nuovo, e il secondo colpo sarebbe
             una seconda richiesta identica: qui non c'è un carrello da
             svuotare che faccia da freno. */
          <div className="mt-8 rounded border border-rule bg-card p-6">
            <p className="text-lg">{t("handover.done", { name: actionData.name })}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink to={`/requests/${actionData.requestId}`} variant="secondary" size="sm">
                {t("handover.openRequest")}
              </ButtonLink>
              <ButtonLink to="/admin/scan" variant="primary" size="sm">
                {t("handover.scanAnother")}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <Form method="post" className="mt-8 flex flex-col gap-5">
            <PersonPicker people={people} name="userId" label={t("handover.person")} />

            <DateRangeFields
              today={today}
              from={from}
              to={to}
              /* `longer` sempre acceso: la spunta «richiesta speciale» serve
                 a superare il tetto ordinario, che qui non si applica, quindi
                 non avrebbe niente da superare — e tenendola accesa il
                 componente non mostra l'avviso del settimo giorno, che qui
                 sarebbe una bugia.
                 Il campo del motivo che ne viene resta, ed è utile: un admin
                 ci scrive «per il workshop di giovedì» e la nota resta sulla
                 richiesta. Va tenuto in stato vero e non fissato a vuoto —
                 quel campo è `required`, e con un valore che non cambia mai
                 il modulo non si potrebbe più inviare. */
              longer
              purpose={purpose}
              onFromChange={setFrom}
              onToChange={setTo}
              onLongerChange={() => {}}
              onPurposeChange={setPurpose}
            />

            {actionData && !actionData.ok && (
              <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
                {t(actionData.error)}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className={buttonClass("primary", "md", "self-start")}
            >
              {t("handover.submit")}
            </button>
          </Form>
        )}
      </PageShell>
    </main>
  );
}
