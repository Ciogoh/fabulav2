/**
 * Il calendario personale: solo i prestiti di chi ha questo indirizzo.
 *
 * **Uno per persona, e nessuno globale.** Non esiste un'esportazione con le
 * occupazioni di tutti: chi vuole i propri impegni aggiunge il proprio
 * indirizzo, non uno condiviso da rileggere cercandosi in mezzo agli altri.
 *
 * **Questo indirizzo è una credenziale** — l'unica cosa che lo protegge è il
 * token nell'URL. Da qui le regole di questo file: `Cache-Control: private,
 * no-store`, `X-Robots-Tag: noindex`, mai loggare il token, e **404 muto**
 * per un token sbagliato — la stessa risposta per «non è mai esistito» e per
 * «è stato revocato», o l'indirizzo diventerebbe un modo per indovinare se
 * un token rubato è ancora buono. Vedi Sicurezza in CLAUDE.md.
 *
 * Solo `APPROVED` e `PENDING`, questi ultimi `STATUS:TENTATIVE`: le
 * richieste rifiutate o annullate non sono un impegno, e chi guarda deve
 * poterle distinguere a colpo d'occhio dalle altre. Gli oggetti già
 * restituiti spariscono: è un'agenda di ciò che resta da fare, non uno
 * storico — quello vive in `/requests`.
 *
 * **Un evento per oggetto e non per richiesta**: se una richiesta ha pezzi in
 * magazzini diversi, un evento solo potrebbe portare una `LOCATION` sola che
 * mentirebbe su metà dei pezzi.
 */

import type { Route } from "./+types/cal.$token[.]ics";
import { db } from "~/lib/db.server";
import { formatDay } from "~/lib/availability.server";
import { buildCalendar, type CalendarEntry } from "~/lib/ical.server";
import { displayNameOf } from "~/lib/person";

export async function loader({ request, params }: Route.LoaderArgs) {
  const token = params.token;

  const user = token
    ? await db.user.findUnique({
        where: { calendarToken: token },
        select: { id: true, name: true, firstName: true, lastName: true, alias: true },
      })
    : null;

  if (!user) throw new Response("Not found", { status: 404 });

  const items = await db.requestItem.findMany({
    where: {
      returnedAt: null,
      request: { userId: user.id, status: { in: ["APPROVED", "PENDING"] } },
    },
    select: {
      id: true,
      requestId: true,
      pickedUpAt: true,
      asset: { select: { name: true, location: true } },
      request: { select: { startDate: true, endDate: true, status: true } },
    },
    orderBy: { request: { startDate: "asc" } },
  });

  const origin = new URL(request.url).origin;

  const entries: CalendarEntry[] = items.map((item) => {
    const pending = item.request.status === "PENDING";
    const state = pending
      ? "In attesa di approvazione."
      : item.pickedUpAt
        ? "In uso."
        : "Prenotato.";
    const period = `${formatDay(item.request.startDate)} → ${formatDay(item.request.endDate)}`;

    return {
      uid: item.id,
      assetName: item.asset.name,
      startDate: item.request.startDate,
      endDate: item.request.endDate,
      pickedUp: Boolean(item.pickedUpAt),
      pending,
      location: item.asset.location,
      description: `${state} ${period}\n${origin}/requests/${item.requestId}`,
      returnReminder: true,
    };
  });

  const body = buildCalendar(entries, {
    name: `Fabula — ${displayNameOf(user)}`,
    description: "I tuoi prestiti su Fabula.",
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Privato per costruzione: nessuna cache condivisa fra due persone che
      // passassero dallo stesso proxy, e fuori dagli indici di chi scansiona
      // il sito.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Content-Disposition": 'inline; filename="fabula-personale.ics"',
    },
  });
}
