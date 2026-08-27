/**
 * Il Centro: tutto quello che aspetta un admin, in una schermata sola.
 *
 * Prima erano tre posti e nessuno che li riassumesse — `/admin/requests`,
 * `/admin/overdue`, e la chat, che non aveva **nessuna** superficie propria:
 * una risposta di un socio dentro a una richiesta non compariva da nessuna
 * parte finché non si apriva quella richiesta. Il lavoro di un turno non
 * aveva un posto dove stare.
 *
 * ## L'ordine delle sezioni non è per gravità
 *
 * È per **chi sta aspettando te**. Su un ritardo il tempo è già passato e
 * nessuno è fermo davanti a una tua azione; su una richiesta in attesa c'è
 * una persona che aspetta, magari da giorni. Quindi: da approvare, messaggi,
 * oggi e domani, in ritardo.
 *
 * Con **un'eccezione sola e dichiarata**: se c'è un oggetto in ritardo da più
 * di una settimana, quella sezione sale in cima. Una regola, visibile e
 * spiegabile — non un riordinamento intelligente che sposta le cose sotto le
 * dita di chi le sta guardando.
 *
 * ## Nessuna azione qui dentro
 *
 * Ogni riga porta al dettaglio, dove approva, rifiuta, ritiro, riconsegna e
 * chat esistono già. È la scelta presa quando è nata la coda di approvazione
 * e resta giusta: approvare da un elenco vuol dire approvare senza aver
 * letto.
 *
 * ## Le due rotte vecchie
 *
 * `/admin/requests` e `/admin/overdue` rimandano qui con `?vista=`, che
 * mostra una sezione sola. I segnalibri continuano a funzionare e le query
 * vivono in un posto solo invece che in tre file.
 */

import { Link } from "react-router";
import type { Route } from "./+types/admin";
import { PageShell, PageTitle } from "~/components/page";
import { pageTitle } from "~/i18n/meta";
import { PersonInline } from "~/components/person";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { formatDay, todayUtc } from "~/lib/availability.server";
import { unreadForAdminIds } from "~/lib/inbox.server";
import { useFormatDay, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import type { Person } from "~/lib/person";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "inbox.heading") }];
}

/** Oltre questa soglia un ritardo smette di essere una cosa da ricordare e
 * diventa la prima cosa da guardare. Vedi il blocco in cima. */
const OVERDUE_ESCALATION_DAYS = 7;

/** Le quattro sezioni. `null` vuol dire «tutte». */
const VIEWS = ["approvare", "messaggi", "oggi", "ritardo"] as const;
type View = (typeof VIEWS)[number];

/** I campi di chi ha chiesto, sempre gli stessi: alias per l'interfaccia,
 * nome vero perché chi decide deve sapere con chi ha a che fare (regola 6). */
const HOLDER = {
  name: true,
  firstName: true,
  lastName: true,
  alias: true,
  image: true,
  email: true,
} as const;

type Holder = { holder: Person; holderEmail: string };

function holderOf(user: {
  name: string;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  image: string | null;
  email: string;
}): Holder {
  return {
    holder: {
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      alias: user.alias,
      image: user.image,
    },
    holderEmail: user.email,
  };
}

function shiftDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const raw = new URL(request.url).searchParams.get("vista");
  const view = (VIEWS as readonly string[]).includes(raw ?? "")
    ? (raw as View)
    : null;

  const today = todayUtc();
  const tomorrow = shiftDays(today, 1);

  const unreadIds = await unreadForAdminIds();

  const [pending, unread, overdue, soon] = await Promise.all([
    db.request.findMany({
      where: { status: "PENDING" },
      // Le più vecchie prima: si smaltisce dall'alto.
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        purpose: true,
        createdAt: true,
        user: { select: HOLDER },
        items: { select: { asset: { select: { name: true } } } },
      },
    }),

    // Gli id li ha scelti l'SQL di `inbox.server.ts`; i campi si scelgono qui,
    // uno per uno, come ovunque.
    db.request.findMany({
      where: { id: { in: unreadIds } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        user: { select: HOLDER },
        items: { select: { asset: { select: { name: true } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true },
        },
      },
    }),

    db.request.findMany({
      where: {
        status: "APPROVED",
        endDate: { lt: today },
        items: {
          some: { pickedUpAt: { not: null }, returnedAt: null, asset: { archivedAt: null } },
        },
      },
      orderBy: { endDate: "asc" },
      select: {
        id: true,
        endDate: true,
        user: { select: HOLDER },
        items: {
          where: { pickedUpAt: { not: null }, returnedAt: null, asset: { archivedAt: null } },
          select: { asset: { select: { name: true } } },
        },
      },
    }),

    /* Oggi e domani, ritiri e riconsegne insieme: sono la stessa domanda —
       «cosa succede in magazzino nelle prossime ore» — e una richiesta può
       stare in tutte e due (finisce domani e ne comincia un'altra). */
    db.request.findMany({
      where: {
        status: "APPROVED",
        OR: [
          {
            startDate: { gte: today, lte: tomorrow },
            items: { some: { pickedUpAt: null, asset: { archivedAt: null } } },
          },
          {
            endDate: { gte: today, lte: tomorrow },
            items: {
              some: { pickedUpAt: { not: null }, returnedAt: null, asset: { archivedAt: null } },
            },
          },
        ],
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        user: { select: HOLDER },
        items: {
          select: {
            pickedUpAt: true,
            returnedAt: true,
            asset: { select: { name: true, archivedAt: true } },
          },
        },
      },
    }),
  ]);

  const todayKey = formatDay(today);
  const tomorrowKey = formatDay(tomorrow);

  /* Una richiesta può produrre due righe — «da consegnare» e «da ricevere» —
     e ognuna elenca **solo** gli oggetti che riguardano quel verso: dire «da
     riconsegnare: A, B» quando B è già tornato manderebbe qualcuno a cercare
     una cosa che è già sullo scaffale. */
  const soonRows = soon.flatMap((r) => {
    const day = formatDay(r.startDate);
    const endDay = formatDay(r.endDate);
    const rows: Array<{
      id: string;
      kind: "pickup" | "return";
      when: "today" | "tomorrow";
      itemNames: string[];
    } & Holder> = [];

    const toPickUp = r.items.filter(
      (item) => item.pickedUpAt === null && item.asset.archivedAt === null
    );
    if ((day === todayKey || day === tomorrowKey) && toPickUp.length > 0) {
      rows.push({
        id: r.id,
        kind: "pickup",
        when: day === todayKey ? "today" : "tomorrow",
        itemNames: toPickUp.map((item) => item.asset.name),
        ...holderOf(r.user),
      });
    }

    const toReturn = r.items.filter(
      (item) =>
        item.pickedUpAt !== null &&
        item.returnedAt === null &&
        item.asset.archivedAt === null
    );
    if ((endDay === todayKey || endDay === tomorrowKey) && toReturn.length > 0) {
      rows.push({
        id: r.id,
        kind: "return",
        when: endDay === todayKey ? "today" : "tomorrow",
        itemNames: toReturn.map((item) => item.asset.name),
        ...holderOf(r.user),
      });
    }

    return rows;
  });

  const overdueRows = overdue.map((r) => ({
    id: r.id,
    endDate: formatDay(r.endDate),
    daysLate: Math.round((today.getTime() - r.endDate.getTime()) / 86_400_000),
    itemNames: r.items.map((item) => item.asset.name),
    ...holderOf(r.user),
  }));

  return {
    view,
    pending: pending.map((r) => ({
      id: r.id,
      startDate: formatDay(r.startDate),
      endDate: formatDay(r.endDate),
      // Il riassunto, non il testo intero: serve a decidere quale guardare per
      // prima, e a quello bastano due righe.
      purpose: r.purpose ? r.purpose.slice(0, 160) : null,
      waitingDays: Math.round(
        (Date.now() - r.createdAt.getTime()) / 86_400_000
      ),
      itemNames: r.items.map((item) => item.asset.name),
      ...holderOf(r.user),
    })),
    unread: unread.map((r) => ({
      id: r.id,
      itemNames: r.items.map((item) => item.asset.name),
      lastMessage: r.messages[0]
        ? {
            body: r.messages[0].body.slice(0, 200),
            createdAt: r.messages[0].createdAt.toISOString(),
          }
        : null,
      ...holderOf(r.user),
    })),
    soon: soonRows,
    overdue: overdueRows,
    // L'eccezione all'ordine fisso, decisa qui una volta sola.
    overdueFirst: overdueRows.some(
      (row) => row.daysLate > OVERDUE_ESCALATION_DAYS
    ),
  };
}

export default function AdminInbox({ loaderData }: Route.ComponentProps) {
  const { view, pending, unread, soon, overdue, overdueFirst } = loaderData;
  const t = useT();

  const counts = {
    approvare: pending.length,
    messaggi: unread.length,
    oggi: soon.length,
    ritardo: overdue.length,
  } satisfies Record<View, number>;

  const total = counts.approvare + counts.messaggi + counts.ritardo;

  const sections: View[] = overdueFirst
    ? ["ritardo", "approvare", "messaggi", "oggi"]
    : ["approvare", "messaggi", "oggi", "ritardo"];

  const shown = view ? sections.filter((name) => name === view) : sections;

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("inbox.heading")} />

        {/* La striscia in cima è la navigazione vera: nessuna sezione può
            sparire sotto la piega dello schermo, e da telefono si arriva dove
            serve con un tocco. */}
        <nav
          aria-label={t("inbox.heading")}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          {view && <Chip to="/admin" label={t("inbox.showAll")} />}
          {sections.map((name) => (
            <Chip
              key={name}
              to={view === name ? "/admin" : `/admin?vista=${name}`}
              label={t(SECTION_LABELS[name])}
              count={counts[name]}
              tone={name === "ritardo" ? "out" : "accent"}
              current={view === name}
            />
          ))}
        </nav>

        {total === 0 && !view && (
          <p className="mt-16 text-center text-muted">{t("inbox.allClear")}</p>
        )}

        {shown.map((name) => (
          <section key={name} id={name} className="mt-10">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
              {t(SECTION_LABELS[name])}
            </h2>

            {/* Una sezione vuota si richiude in una riga: una giornata
                tranquilla deve stare in mezzo schermo, non in quattro
                intestazioni vuote. */}
            {counts[name] === 0 ? (
              <p className="mt-2 text-sm text-muted">{t(EMPTY_LABELS[name])}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {name === "approvare" &&
                  pending.map((r) => (
                    <Row key={r.id} to={`/requests/${r.id}`}>
                      <Head
                        left={<Dates from={r.startDate} to={r.endDate} />}
                        right={
                          r.waitingDays > 0 ? (
                            <Pill tone="accent">
                              {t("inbox.waitingDays", { count: r.waitingDays })}
                            </Pill>
                          ) : null
                        }
                      />
                      <Who holder={r.holder} email={r.holderEmail} />
                      <Items names={r.itemNames} />
                      {r.purpose && (
                        <p className="mt-1 line-clamp-2 text-sm italic text-muted">
                          &ldquo;{r.purpose}&rdquo;
                        </p>
                      )}
                    </Row>
                  ))}

                {name === "messaggi" &&
                  unread.map((r) => (
                    <Row key={r.id} to={`/requests/${r.id}`}>
                      <Who holder={r.holder} email={r.holderEmail} />
                      {r.lastMessage && (
                        <p className="mt-1 line-clamp-2 text-sm">
                          {r.lastMessage.body}
                        </p>
                      )}
                      <Items names={r.itemNames} />
                    </Row>
                  ))}

                {name === "oggi" &&
                  soon.map((r) => (
                    <Row key={`${r.id}-${r.kind}`} to={`/requests/${r.id}`}>
                      <Head
                        left={
                          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                            {t(
                              r.kind === "pickup"
                                ? r.when === "today"
                                  ? "inbox.pickupToday"
                                  : "inbox.pickupTomorrow"
                                : r.when === "today"
                                  ? "inbox.returnToday"
                                  : "inbox.returnTomorrow"
                            )}
                          </span>
                        }
                      />
                      <Who holder={r.holder} email={r.holderEmail} />
                      <Items names={r.itemNames} />
                    </Row>
                  ))}

                {name === "ritardo" &&
                  overdue.map((r) => (
                    <Row key={r.id} to={`/requests/${r.id}`}>
                      <Head
                        left={<Due date={r.endDate} />}
                        right={
                          <Pill tone="out">
                            {t("overdue.daysLate", { count: r.daysLate })}
                          </Pill>
                        }
                      />
                      <Who holder={r.holder} email={r.holderEmail} />
                      <Items names={r.itemNames} />
                    </Row>
                  ))}
              </ul>
            )}
          </section>
        ))}
      </PageShell>
    </main>
  );
}

/* ------------------------------------------------------------- etichette */

const SECTION_LABELS: Record<View, TranslationKey> = {
  approvare: "inbox.pending",
  messaggi: "inbox.messages",
  oggi: "inbox.soon",
  ritardo: "inbox.overdue",
};

const EMPTY_LABELS: Record<View, TranslationKey> = {
  approvare: "inbox.pendingEmpty",
  messaggi: "inbox.messagesEmpty",
  oggi: "inbox.soonEmpty",
  ritardo: "inbox.overdueEmpty",
};

/* ---------------------------------------------------------------- pezzi */

function Chip({
  to,
  label,
  count,
  tone = "accent",
  current = false,
}: {
  to: string;
  label: string;
  count?: number;
  tone?: "accent" | "out";
  current?: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm ${
        current
          ? "border-accent bg-accent-soft text-ink"
          : "border-rule text-muted hover:border-accent hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 font-mono text-[0.65rem] font-medium ${
            tone === "out" ? "bg-out-bg text-out" : "bg-accent-soft text-accent"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function Row({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="block rounded border border-rule bg-card p-4 hover:border-accent"
      >
        {children}
      </Link>
    </li>
  );
}

function Head({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {left}
      {right}
    </div>
  );
}

function Pill({ tone, children }: { tone: "accent" | "out"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider ${
        tone === "out" ? "bg-out-bg text-out" : "bg-sunk text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function Dates({ from, to }: { from: string; to: string }) {
  const formatDayLabel = useFormatDay();
  return (
    <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
      {formatDayLabel(from)} — {formatDayLabel(to)}
    </span>
  );
}

function Due({ date }: { date: string }) {
  const t = useT();
  const formatDayLabel = useFormatDay();
  return (
    <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
      {t("overdue.dueOn", { date: formatDayLabel(date) })}
    </span>
  );
}

/* Una frase sola e non tre riquadri affiancati: da telefono il `flex
   flex-wrap` staccava l'avatar dal nome a fine riga. */
function Who({ holder, email }: { holder: Person; email: string }) {
  const t = useT();
  return (
    <p className="mt-2 text-sm">
      {t("requests.admin.requestedBy")} <PersonInline person={holder} />{" "}
      <span className="text-muted">({email})</span>
    </p>
  );
}

function Items({ names }: { names: string[] }) {
  return <p className="mt-1 text-sm text-muted">{names.join(" · ")}</p>;
}
