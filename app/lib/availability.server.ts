/**
 * Il motore di disponibilità.
 *
 * Tutto il sistema poggia su una domanda sola: *questo oggetto ha una
 * prenotazione che si sovrappone al periodo richiesto?* Con i pezzi unici la
 * risposta è sì o no, e questo file resta corto. È il motivo per cui le
 * quantità sono state escluse dalla specifica.
 *
 * Nessuno stato è salvato sugli oggetti: si ricava tutto dalle richieste, così
 * il catalogo non può mai raccontare qualcosa di diverso dalla realtà.
 */

import { db } from "~/lib/db.server";
import { displayNameOf, fullLabelOf, type Person } from "~/lib/person";

// I due tetti di durata vivono in `availability.shared.ts`, che il browser
// può importare senza tirarsi dietro Prisma; qui si ri-esportano perché il
// lato server continui a trovarli dove li ha sempre trovati.
export {
  MAX_ORDINARY_SPAN_DAYS,
  MAX_SPECIAL_SPAN_DAYS,
} from "~/lib/availability.shared";

/** Lo stato di oggi, quando non è stato scelto nessun periodo. */
export type AssetState = "FREE" | "RESERVED" | "IN_USE";

/**
 * Quello che finisce sul badge. `UNAVAILABLE` esiste solo quando è stato
 * scelto un periodo: lì non interessa *perché* l'oggetto è occupato, solo che
 * in quelle date non si può avere.
 */
export type DisplayState = AssetState | "UNAVAILABLE";

export type AssetAvailability = {
  state: DisplayState;
  /** Quando l'oggetto torna disponibile. Nullo se è già libero. */
  until: Date | null;
  /** Quando inizia la prenotazione, se non è ancora cominciata. */
  from: Date | null;
};

/** Le date del prestito sono giorni interi, salvati a mezzanotte UTC. */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/** Interpreta un `2026-09-03` da querystring o form come giorno intero UTC. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Le prenotazioni che tengono occupato un oggetto: approvate, non ancora
 * restituite. In attesa e rifiutate non bloccano niente — finché un admin non
 * ha detto sì, l'oggetto resta prenotabile da chiunque altro.
 */
const BLOCKING = {
  returnedAt: null,
  request: { status: "APPROVED" as const },
};

/**
 * Gli id degli oggetti occupati in un dato periodo.
 *
 * Due intervalli si sovrappongono quando ciascuno inizia prima che l'altro
 * finisca: `inizioA <= fineB && fineA >= inizioB`. Gli estremi sono inclusi,
 * perché un prestito che finisce il 7 tiene l'oggetto per tutto il 7.
 */
export async function getBusyAssetIds(
  start: Date,
  end: Date,
  options: { excludeRequestId?: string } = {}
): Promise<Set<string>> {
  const items = await db.requestItem.findMany({
    where: {
      ...BLOCKING,
      // Rimodificare le date di una richiesta già approvata non deve farla
      // risultare in conflitto con sé stessa — i suoi stessi oggetti sono
      // "occupati" solo perché è lei ad occuparli.
      ...(options.excludeRequestId ? { requestId: { not: options.excludeRequestId } } : {}),
      request: {
        ...BLOCKING.request,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    },
    select: { assetId: true },
  });

  return new Set(items.map((item) => item.assetId));
}

/**
 * Lo stato attuale di ogni oggetto, per i badge del catalogo quando non è
 * stato scelto nessun periodo.
 *
 * Una query sola per tutti gli oggetti: il catalogo mostra decine di schede
 * per pagina e interrogare il database una volta per scheda lo metterebbe in
 * ginocchio ben prima di avere un numero di oggetti interessante.
 */
export async function getCurrentAvailability(): Promise<
  Map<string, AssetAvailability>
> {
  const today = todayUtc();

  const items = await db.requestItem.findMany({
    where: {
      ...BLOCKING,
      request: {
        ...BLOCKING.request,
        // Quello che è già finito non interessa; quello che deve ancora
        // iniziare sì, perché va annunciato nel catalogo.
        endDate: { gte: today },
      },
    },
    select: {
      assetId: true,
      pickedUpAt: true,
      request: { select: { startDate: true, endDate: true } },
    },
    orderBy: { request: { startDate: "asc" } },
  });

  const availability = new Map<string, AssetAvailability>();

  for (const item of items) {
    // `orderBy` garantisce che il primo che incontriamo sia il più imminente.
    if (availability.has(item.assetId)) continue;

    const inUse = item.pickedUpAt !== null;
    const started = item.request.startDate <= today;

    availability.set(item.assetId, {
      state: inUse ? "IN_USE" : "RESERVED",
      until: item.request.endDate,
      from: started ? null : item.request.startDate,
    });
  }

  return availability;
}

/** Lo stato di un oggetto che non compare nella mappa: nessuna prenotazione. */
export const FREE: AssetAvailability = {
  state: "FREE",
  until: null,
  from: null,
};

/* ----------------------------------------------------------- calendario */

/** Come appare un'occupazione sul calendario. */
export type OccupancyState = "REQUESTED" | "RESERVED" | "IN_USE";

export type Occupancy = {
  id: string;
  requestId: string;
  assetId: string;
  assetName: string;
  startDate: Date;
  endDate: Date;
  state: OccupancyState;
  /** Chi ha in mano l'oggetto, come si fa chiamare. Presente **solo** per
   * gli amministratori. */
  holder: string | null;
  /** Lo stesso, ma con il nome vero fra parentesi quando c'è un alias: sulla
   * barra non ci sta, nel suggerimento del passaggio del mouse sì. */
  holderFull: string | null;
};

/**
 * Le occupazioni che si sovrappongono a una finestra di giorni.
 *
 * `includePending` accende anche le richieste ancora da approvare: sul
 * calendario sono utili — dicono «qualcuno l'ha già chiesto per quelle date» —
 * ma non compaiono nell'esportazione iCal, perché lì un'occupazione deve
 * significare che l'oggetto è davvero impegnato.
 *
 * `withHolders` aggiunge i nomi. Va acceso solo dopo `requireAdmin`: il
 * catalogo pubblico non dice mai chi ha cosa.
 */
export async function getOccupancy(
  start: Date,
  end: Date,
  options: { includePending?: boolean; withHolders?: boolean } = {}
): Promise<Occupancy[]> {
  const statuses = options.includePending
    ? (["APPROVED", "PENDING"] as const)
    : (["APPROVED"] as const);

  const items = await db.requestItem.findMany({
    where: {
      returnedAt: null,
      request: {
        status: { in: [...statuses] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    },
    select: {
      id: true,
      requestId: true,
      assetId: true,
      pickedUpAt: true,
      asset: { select: { name: true } },
      request: {
        select: {
          startDate: true,
          endDate: true,
          status: true,
          user: options.withHolders
            ? {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                  alias: true,
                },
              }
            : false,
        },
      },
    },
    orderBy: { request: { startDate: "asc" } },
  });

  return items.map((item) => ({
    id: item.id,
    requestId: item.requestId,
    assetId: item.assetId,
    assetName: item.asset.name,
    startDate: item.request.startDate,
    endDate: item.request.endDate,
    state:
      item.request.status === "PENDING"
        ? "REQUESTED"
        : item.pickedUpAt
          ? "IN_USE"
          : "RESERVED",
    ...holderOf(options.withHolders === true, item.request),
  }));
}

/**
 * I due nomi di chi ha in mano l'oggetto, o due `null`.
 *
 * Sta in una funzione a parte perché il pubblico non deve vederne nessuno dei
 * due: `withHolders` spento è il caso normale, e questa è l'unica porta da
 * cui i nomi possono uscire.
 */
function holderOf(
  withHolders: boolean,
  request: { user?: Person | null }
): { holder: string | null; holderFull: string | null } {
  const user = withHolders ? request.user : null;
  if (!user) return { holder: null, holderFull: null };
  return { holder: displayNameOf(user), holderFull: fullLabelOf(user) };
}
