/**
 * Il Centro: tutto quello che aspetta un admin, in una schermata sola.
 *
 * Prima erano tre posti e nessuno che li riassumesse — `/admin/requests`,
 * `/admin/overdue`, e la chat, che non aveva **nessuna** superficie propria:
 * una risposta di un socio dentro a una richiesta non compariva da nessuna
 * parte finché non si apriva quella richiesta. Il lavoro di un turno non
 * aveva un posto dove stare.
 *
 * ## Una coda e un'agenda, e non quattro sezioni
 *
 * La prima versione tagliava lo stesso lavoro in **quattro** — da approvare,
 * messaggi, oggi e domani, in ritardo — con quattro pastiglie in cima per
 * filtrarle. In una giornata tranquilla il risultato era quattro intestazioni
 * e tre righe che dicono «niente» per mostrare **un** oggetto: metà schermo
 * speso per dire che non c'è nulla da fare. E una richiesta in ritardo che
 * aveva anche un messaggio non letto compariva **due volte**, in due sezioni,
 * come se fossero due cose da fare invece di una da aprire.
 *
 * Le quattro sezioni erano una tassonomia, non un elenco di cose da fare. Ma
 * mescolarle tutte in una lista sola sarebbe stato sbagliato allo stesso
 * modo, perché **una delle quattro non è una coda**:
 *
 * - **Da approvare, messaggi, ritardi** aspettano una decisione tua, e si
 *   svuotano: quando hai deciso, la riga sparisce.
 * - **Oggi e domani** non si svuota: si legge. Un ritiro di domani non
 *   aspetta niente da te *adesso* — è l'agenda del magazzino, e metterlo in
 *   una lista che stai cercando di finire vuol dire metterci dentro una riga
 *   che non si può finire.
 *
 * Quindi: una coda sola in cima, l'agenda sotto, e nessuna pastiglia. **Una
 * riga per richiesta, non per motivo**: i motivi diventano marcatori sulla
 * riga, e una richiesta che ne ha due si apre una volta sola.
 *
 * ## L'ordine non è per gravità
 *
 * È per **chi sta aspettando te**. Su un ritardo il tempo è già passato e
 * nessuno è fermo davanti a una tua azione; su una richiesta in attesa c'è
 * una persona che aspetta, magari da giorni. Quindi: prima da approvare, poi
 * i messaggi, poi i ritardi — e a parità, chi aspetta da più tempo.
 *
 * Con **un'eccezione sola e dichiarata**: un ritardo oltre la settimana sale
 * in cima. Una regola, visibile e spiegabile — non un riordinamento
 * intelligente che sposta le cose sotto le dita di chi le sta guardando.
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
 * `/admin/requests` e `/admin/overdue` rimandano qui. Rimandavano con
 * `?vista=`, che mostrava una sezione sola; adesso che le sezioni non ci sono
 * più il filtro non ha più niente da filtrare, e il segnalibro atterra sulla
 * pagina intera — che è comunque corta.
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
import { useFormatDay, useLang, useT } from "~/i18n/use-t";
import { useLive } from "~/lib/use-live";
import type { TranslationKey } from "~/i18n/dictionaries";
import type { Person } from "~/lib/person";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "inbox.heading") }];
}

/** Oltre questa soglia un ritardo smette di essere una cosa da ricordare e
 * diventa la prima cosa da guardare. Vedi il blocco in cima. */
const OVERDUE_ESCALATION_DAYS = 7;

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

  /* ------------------------------------------------------------ la coda

     Una riga per **richiesta**, non per motivo. Prima le tre query
     producevano tre elenchi separati, e una richiesta in ritardo che aveva
     anche un messaggio non letto compariva due volte: due righe da leggere,
     due da aprire, per una cosa sola da sistemare. Qui si fondono su `id`, e
     i motivi si accumulano sulla stessa riga. */

  const queue = new Map<string, QueueRow>();

  function rowFor(id: string, user: Parameters<typeof holderOf>[0], itemNames: string[]) {
    const existing = queue.get(id);
    if (existing) return existing;
    const created: QueueRow = { id, ...holderOf(user), itemNames, reasons: [] };
    queue.set(id, created);
    return created;
  }

  for (const r of pending) {
    rowFor(r.id, r.user, r.items.map((item) => item.asset.name)).reasons.push({
      kind: "approve",
      startDate: formatDay(r.startDate),
      endDate: formatDay(r.endDate),
      // Il riassunto, non il testo intero: serve a decidere quale guardare
      // per prima, e a quello bastano due righe.
      purpose: r.purpose ? r.purpose.slice(0, 160) : null,
      waitingDays: Math.round((Date.now() - r.createdAt.getTime()) / 86_400_000),
    });
  }

  for (const r of unread) {
    const message = r.messages[0];
    // Senza messaggio non c'è niente da leggere, quindi non c'è riga: gli id
    // arrivano da una query che il messaggio ce l'ha, ma una riga vuota qui
    // sarebbe un motivo senza motivo.
    if (!message) continue;
    rowFor(r.id, r.user, r.items.map((item) => item.asset.name)).reasons.push({
      kind: "unread",
      body: message.body.slice(0, 200),
      createdAt: message.createdAt.toISOString(),
    });
  }

  for (const r of overdue) {
    const row = rowFor(r.id, r.user, r.items.map((item) => item.asset.name));
    /* Gli oggetti **ancora fuori** sono l'elenco più preciso, e vince su
       quello completo: dire «in ritardo: A, B» quando B è già tornato manda
       qualcuno a cercare una cosa che è già sullo scaffale. */
    row.itemNames = r.items.map((item) => item.asset.name);
    row.reasons.push({
      kind: "overdue",
      endDate: formatDay(r.endDate),
      daysLate: Math.round((today.getTime() - r.endDate.getTime()) / 86_400_000),
    });
  }

  /* L'ordine dentro a un blocco. `rank` è la regola scritta in cima — chi sta
     aspettando te — e `waiting` è lo spareggio: a parità di motivo, chi
     aspetta da più tempo sta sopra. */
  const rows = [...queue.values()]
    .map((row) => {
      const late = row.reasons.find(
        (reason): reason is Extract<Reason, { kind: "overdue" }> =>
          reason.kind === "overdue"
      );

      return {
        ...row,
        rank:
          late && late.daysLate > OVERDUE_ESCALATION_DAYS
            ? 0
            : row.reasons.some((reason) => reason.kind === "approve")
              ? 1
              : row.reasons.some((reason) => reason.kind === "unread")
                ? 2
                : 3,
        waiting: Math.max(
          ...row.reasons.map((reason) =>
            reason.kind === "approve"
              ? reason.waitingDays
              : reason.kind === "overdue"
                ? reason.daysLate
                : Math.round((Date.now() - Date.parse(reason.createdAt)) / 86_400_000)
          )
        ),
        hasUnread: row.reasons.some((reason) => reason.kind === "unread"),
        escalated: Boolean(late && late.daysLate > OVERDUE_ESCALATION_DAYS),
      };
    })
    .sort((a, b) => a.rank - b.rank || b.waiting - a.waiting);

  /* **Il taglio è «c'è un messaggio da leggere», non «di che tipo è».**
     Una sezione «Messaggi» che ne contiene solo una parte è peggio che non
     averla: si risponde a una conversazione su tre e ci si crede a posto.
     Quindi ci finisce **tutto** ciò che ha una riga di chat non letta, anche
     quando è pure da approvare o in ritardo — e quei motivi restano scritti
     sulla riga come marcatori, così da lì si vede lo stesso il quadro intero.

     La conseguenza è anche la ragione: **si legge prima di agire.** Quel
     messaggio è spesso la risposta alla cosa che stavi per fare — «passo
     giovedì a riportarlo» risponde al ritardo — e sollecitare qualcuno che
     ti ha appena scritto è il modo più veloce per far smettere di scrivere.

     Nessuna richiesta compare due volte, che è il difetto da cui è nata
     questa pagina. */
  const messages = rows.filter((row) => row.hasUnread);
  const todo = rows.filter((row) => !row.hasUnread);

  return {
    messages,
    todo,
    agenda: soonRows,
    /* L'eccezione dichiarata di sempre, che con i blocchi torna a essere un
       ordine di blocchi: un ritardo oltre la settimana non è più normale
       amministrazione, e passa davanti anche alla lettura. */
    todoFirst: todo.some((row) => row.escalated),
  };
}

/** Perché una richiesta sta nella coda. Una riga può averne più d'uno. */
type Reason =
  | {
      kind: "approve";
      startDate: string;
      endDate: string;
      purpose: string | null;
      waitingDays: number;
    }
  | { kind: "unread"; body: string; createdAt: string }
  | { kind: "overdue"; endDate: string; daysLate: number };

type QueueRow = Holder & {
  id: string;
  itemNames: string[];
  reasons: Reason[];
};

export default function AdminInbox({ loaderData }: Route.ComponentProps) {
  const { messages, todo, agenda, todoFirst } = loaderData;
  const t = useT();

  /* Il Centro è la pagina che un admin tiene aperta in un angolo dello
     schermo mentre fa altro: se non si aggiorna da sola, dice il falso per
     tutto il tempo in cui nessuno la ricarica. */
  useLive("/api/stream");

  /* Messaggi prima, perché **si legge prima di agire** — a meno che ci sia
     un ritardo oltre la settimana, che è l'eccezione dichiarata di sempre.
     Una regola sola, visibile e spiegabile, non un riordinamento intelligente
     che sposta le cose sotto le dita di chi le sta guardando. */
  const blocks = todoFirst
    ? ([
        ["todo", todo],
        ["messages", messages],
      ] as const)
    : ([
        ["messages", messages],
        ["todo", todo],
      ] as const);

  const nothing =
    messages.length === 0 && todo.length === 0 && agenda.length === 0;

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("inbox.heading")} />

        {nothing && <p className="mt-8 text-muted">{t("inbox.allClear")}</p>}

        {/* **Una sezione vuota non si disegna.** Erano quattro intestazioni
            con sotto tre righe che dicono «niente»: metà schermo speso per
            raccontare che non c'è nulla da fare. L'assenza di messaggi si
            vede benissimo dal fatto che non ce ne sono, e quando tutto è
            vuoto la riga qui sopra lo dice una volta per tutte. */}
        {blocks.map(([name, rows]) =>
          rows.length === 0 ? null : (
            <Section
              key={name}
              label={t(name === "messages" ? "inbox.messages" : "inbox.todo")}
            >
              {rows.map((row) => (
                <QueueEntry key={row.id} row={row} />
              ))}
            </Section>
          )
        )}

        {agenda.length > 0 && (
          <Section label={t("inbox.soon")}>
            {agenda.map((r) => (
              <Row key={`${r.id}-${r.kind}`} to={`/requests/${r.id}`}>
                <Head
                  left={
                    <span className="eyebrow">
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
          </Section>
        )}
      </PageShell>
    </main>
  );
}

/** Un blocco con la sua etichetta. Esiste solo quando ha qualcosa dentro:
 *  chi lo disegna controlla prima, così il titolo e il filo di separazione
 *  non compaiono mai da soli. */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-rule pt-6 first-of-type:mt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="eyebrow">{label}</h2>
      <ul className="mt-3 flex flex-col gap-3">{children}</ul>
    </section>
  );
}

/**
 * Una riga della coda: i marcatori dicono **perché** è lì.
 *
 * A destra dei marcatori c'è **una** data e non tre, scelta dal motivo più
 * urgente della riga. Tre indicazioni di tempo su una riga sola — «scadenza
 * 24 ago», «24 ago — 28 ago», «ieri alle 18:40» — non si leggono: si
 * scavalcano.
 *
 * Il ritardo è l'unico marcatore pieno. È anche l'unica cosa in questa pagina
 * che è già andata storta: gli altri due sono lavoro normale, e un lavoro
 * normale che grida quanto un problema toglie forza al problema.
 */
function QueueEntry({
  row,
}: {
  row: Route.ComponentProps["loaderData"]["messages"][number];
}) {
  const t = useT();

  const approve = row.reasons.find((r) => r.kind === "approve");
  const unread = row.reasons.find((r) => r.kind === "unread");
  const late = row.reasons.find((r) => r.kind === "overdue");

  return (
    <Row to={`/requests/${row.id}`}>
      <Head
        left={
          <span className="flex flex-wrap items-center gap-2">
            {late && (
              <Pill tone="alarm">
                {t("overdue.daysLate", { count: late.daysLate })}
              </Pill>
            )}
            {approve && <Pill tone="quiet">{t("inbox.pending")}</Pill>}
            {unread && <Pill tone="quiet">{t("inbox.reasonUnread")}</Pill>}
          </span>
        }
        right={
          late ? (
            <Due date={late.endDate} />
          ) : approve ? (
            <Dates from={approve.startDate} to={approve.endDate} />
          ) : unread ? (
            <MessageTime at={unread.createdAt} />
          ) : null
        }
      />

      <Who holder={row.holder} email={row.holderEmail} />
      <Items names={row.itemNames} />

      {/* Il testo, quando c'è: la risposta del socio prima del motivo della
          richiesta, perché è la cosa nuova. */}
      {unread && <p className="mt-1 line-clamp-2 text-sm">{unread.body}</p>}
      {approve?.purpose && (
        <p className="mt-1 line-clamp-2 text-sm italic text-muted">
          &ldquo;{approve.purpose}&rdquo;
        </p>
      )}
    </Row>
  );
}

/* ---------------------------------------------------------------- pezzi */

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

/**
 * `alarm` è il terzo tono, ed è pieno.
 *
 * `out` (velato) andava bene finché il ritardo era una sezione con la sua
 * intestazione: il contesto lo diceva già. Dentro a una riga in mezzo alle
 * altre, una velatura rossa pesa quanto una velatura grigia, e il ritardo
 * smette di distinguersi da «da approvare». Sopra al fondo pieno ci va
 * `--on-out` e mai `white` — nel tema scuro `--out-solid` è chiaro.
 */
function Pill({
  tone,
  children,
}: {
  tone: "quiet" | "out" | "alarm";
  children: React.ReactNode;
}) {
  const TONES = {
    quiet: "bg-sunk text-muted",
    out: "bg-out-bg text-out",
    alarm: "bg-out-solid text-on-out",
  } as const;

  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

function Dates({ from, to }: { from: string; to: string }) {
  const formatDayLabel = useFormatDay();
  return (
    <span className="eyebrow">
      {formatDayLabel(from)} — {formatDayLabel(to)}
    </span>
  );
}

function Due({ date }: { date: string }) {
  const t = useT();
  const formatDayLabel = useFormatDay();
  return (
    <span className="eyebrow">
      {t("overdue.dueOn", { date: formatDayLabel(date) })}
    </span>
  );
}

/**
 * Una frase sola e non tre riquadri affiancati: da telefono il `flex
 * flex-wrap` staccava l'avatar dal nome a fine riga.
 *
 * **L'indirizzo sparisce sotto ai 640px.** Su un telefono si prendeva una
 * riga intera in ogni riga dell'elenco — tre righe su una schermata da tre
 * voci — per dire una cosa che il nome accanto dice già. Non è la regola 6
 * che si allenta: quella parla di **nomi** (si vede chi è davvero, non solo
 * l'alias), e `PersonInline` continua a portare nome e cognome per esteso
 * anche a un lettore di schermo. L'indirizzo serve a scrivere a qualcuno, e
 * si scrive dal dettaglio — dove porta questa riga.
 */
function Who({ holder, email }: { holder: Person; email: string }) {
  const t = useT();
  return (
    <p className="mt-2 text-sm">
      {t("requests.admin.requestedBy")} <PersonInline person={holder} />
      <span className="hidden text-muted sm:inline"> ({email})</span>
    </p>
  );
}

function Items({ names }: { names: string[] }) {
  return <p className="mt-1 text-sm text-muted">{names.join(" · ")}</p>;
}

/** Giorno e ora, come nella chat: la stessa informazione scritta due volte in
 *  due forme diverse costringe a rileggerla ogni volta. */
function MessageTime({ at }: { at: string }) {
  const lang = useLang();
  return (
    <span className="mt-2 shrink-0 font-mono text-2xs text-muted">
      {new Date(at).toLocaleString(lang, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}
