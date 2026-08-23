/**
 * Il calendario da incollare dentro a Google Calendar e simili.
 *
 * È **pubblico e senza nomi**: dice solo quale oggetto è occupato e quando. Un
 * indirizzo iCal non ha modo di chiedere chi sei — i programmi di calendario
 * lo scaricano e basta — quindi tutto quello che ci finisce dentro è di fatto
 * pubblico, e ci mettiamo solo ciò che il catalogo mostra già a chiunque.
 *
 * Con `?asset=<id>` si ottiene il calendario di un oggetto solo, per chi vuole
 * tenere d'occhio la videocamera e non tutto il magazzino.
 */

import type { Route } from "./+types/calendar[.]ics";
import { db } from "~/lib/db.server";
import { getOccupancy, todayUtc } from "~/lib/availability.server";
import { buildCalendar } from "~/lib/ical.server";

/** Quanto passato e quanto futuro esporta il calendario. */
const DAYS_BACK = 90;
const DAYS_AHEAD = 365;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get("asset");

  const today = todayUtc();
  const from = shiftDays(today, -DAYS_BACK);
  const to = shiftDays(today, DAYS_AHEAD);

  // Le richieste in attesa restano fuori: sul calendario di qualcun altro
  // «occupato» deve voler dire occupato davvero, non «forse».
  const occupancy = await getOccupancy(from, to, { includePending: false });

  const filtered = assetId
    ? occupancy.filter((entry) => entry.assetId === assetId)
    : occupancy;

  const asset = assetId
    ? await db.asset.findFirst({
        where: { id: assetId, archivedAt: null },
        select: { name: true },
      })
    : null;

  const body = buildCalendar(
    filtered.map((entry) => ({
      uid: entry.id,
      assetName: entry.assetName,
      startDate: entry.startDate,
      endDate: entry.endDate,
      pickedUp: entry.state === "IN_USE",
    })),
    {
      name: asset ? `Fabula — ${asset.name}` : "Fabula",
      description: asset
        ? `Quando ${asset.name} è occupato.`
        : "Quando gli oggetti dell'associazione sono occupati.",
    }
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Un quarto d'ora di margine: i programmi di calendario riscaricano di
      // rado, ma non ha senso ricalcolare a ogni loro tentativo.
      "Cache-Control": "public, max-age=900",
      "Content-Disposition": 'inline; filename="fabula.ics"',
    },
  });
}

function shiftDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}
