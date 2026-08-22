/**
 * Il calendario condiviso.
 *
 * La scelta di progetto che conta: **le righe sono gli oggetti, le colonne
 * sono i giorni.** Una griglia mensile alla Google Calendar mescola tutte le
 * prenotazioni dentro alle caselle dei giorni, e per rispondere a «quando è
 * libera la videocamera?» bisogna leggersi trenta caselle. Con una riga per
 * oggetto la risposta si vede scorrendo con l'occhio.
 *
 * Di serie compaiono solo gli oggetti che hanno qualcosa nel periodo: con un
 * magazzino di qualche centinaio di pezzi, righe vuote a perdita d'occhio
 * nascondono le poche che contano.
 */

import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/calendar";
import { db } from "~/lib/db.server";
import {
  formatDay,
  getOccupancy,
  parseDay,
  todayUtc,
  type OccupancyState,
} from "~/lib/availability.server";
import { getUser } from "~/lib/session.server";
import { useLang, useT } from "~/i18n/use-t";

/** Cinque settimane: un mese abbondante, ancora leggibile su uno schermo. */
const DAYS = 35;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const showAll = url.searchParams.get("all") === "1";

  // La finestra comincia sempre di lunedì: settimane spezzate a metà sono
  // difficili da leggere.
  const anchor = parseDay(url.searchParams.get("from")) ?? todayUtc();
  const start = startOfWeek(anchor);
  const end = shiftDays(start, DAYS - 1);

  const user = await getUser(request);
  const isAdmin = user?.role === "ADMIN";

  const [assets, occupancy] = await Promise.all([
    db.asset.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: { select: { name: true } },
      },
    }),
    // Le richieste in attesa si vedono: dicono «qualcuno l'ha già chiesto per
    // quelle date», ed è un'informazione utile prima di chiedere lo stesso.
    // `withHolders` solo per admin: il pubblico non deve mai sapere chi ha
    // cosa, solo che è occupato.
    getOccupancy(start, end, { includePending: true, withHolders: isAdmin }),
  ]);

  const busyAssetIds = new Set(occupancy.map((entry) => entry.assetId));
  const rows = (showAll ? assets : assets.filter((a) => busyAssetIds.has(a.id)))
    .map((asset) => ({
      ...asset,
      bars: occupancy
        .filter((entry) => entry.assetId === asset.id)
        .map((entry) => ({
          id: entry.id,
          requestId: entry.requestId,
          state: entry.state,
          holder: entry.holder,
          // Ritagliate sulla finestra: una prenotazione che comincia prima
          // deve comunque disegnarsi dal bordo sinistro.
          offset: Math.max(0, daysBetween(start, entry.startDate)),
          length:
            Math.min(DAYS - 1, daysBetween(start, entry.endDate)) -
            Math.max(0, daysBetween(start, entry.startDate)) +
            1,
          // Un prestito più lungo della finestra si taglia nel disegno, ma
          // continua davvero fuori schermo: la freccia lo dice a chi guarda.
          continuesBefore: entry.startDate < start,
          continuesAfter: entry.endDate > end,
        }))
        .filter((bar) => bar.length > 0),
    }));

  return {
    rows,
    showAll,
    totalAssets: assets.length,
    start: formatDay(start),
    previous: formatDay(shiftDays(start, -DAYS)),
    next: formatDay(shiftDays(start, DAYS)),
    todayOffset: daysBetween(start, todayUtc()),
    days: Array.from({ length: DAYS }, (_, i) => formatDay(shiftDays(start, i))),
    isAdmin,
  };
}

export default function Calendar({ loaderData }: Route.ComponentProps) {
  const { rows, showAll, totalAssets, days, todayOffset, previous, next, isAdmin } =
    loaderData;
  const t = useT();
  const lang = useLang();
  const [searchParams] = useSearchParams();

  const weekday = new Intl.DateTimeFormat(lang, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const monthLabel = new Intl.DateTimeFormat(lang, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const allParam = showAll ? "" : "&all=1";

  // Le 35 celle attraversano spesso un cambio di mese: un segmento per ogni
  // mese diverso, invece di un'unica etichetta che ne racconterebbe solo uno.
  const monthSegments: { key: string; label: string; startIndex: number; span: number }[] = [];
  for (const [index, day] of days.entries()) {
    const date = new Date(`${day}T00:00:00Z`);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const last = monthSegments.at(-1);
    if (last && last.key === key) {
      last.span += 1;
    } else {
      monthSegments.push({ key, label: monthLabel.format(date), startIndex: index, span: 1 });
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {t("calendar.heading")}
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        {t("calendar.intro")}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav className="flex items-center gap-2">
          <NavLink to={`/calendar?from=${previous}${allParam ? "&all=1" : ""}`}>
            ← {t("calendar.previous")}
          </NavLink>
          <NavLink to={showAll ? "/calendar?all=1" : "/calendar"}>
            {t("calendar.today")}
          </NavLink>
          <NavLink to={`/calendar?from=${next}${allParam ? "&all=1" : ""}`}>
            {t("calendar.next")} →
          </NavLink>
        </nav>

        <MonthJump key={days[0]} anchor={days[0]} showAll={showAll} />

        <Link
          to={`/calendar?${new URLSearchParams({
            ...(searchParams.get("from")
              ? { from: searchParams.get("from")! }
              : {}),
            ...(showAll ? {} : { all: "1" }),
          })}`}
          className="ml-auto text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          {showAll ? t("calendar.showBusy") : t("calendar.showAll")}
        </Link>
      </div>

      <Legend />

      {rows.length === 0 ? (
        <p className="mt-16 text-center text-muted">{t("calendar.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded border border-rule bg-card">
          <div
            className="min-w-max"
            style={{ ["--day" as string]: "30px" }}
          >
            {/* I mesi attraversati dalla finestra, con una riga divisoria
                dove uno finisce e comincia il successivo. */}
            <div className="flex border-b border-rule">
              <div className="w-52 shrink-0 border-r border-rule" />
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, var(--day))`,
                }}
              >
                {monthSegments.map((segment, index) => (
                  <div
                    key={segment.key}
                    className={`truncate px-1.5 py-1 text-center font-mono text-[0.62rem] uppercase tracking-widest text-faint ${
                      index > 0 ? "border-l border-rule" : ""
                    }`}
                    style={{ gridColumn: `${segment.startIndex + 1} / span ${segment.span}` }}
                  >
                    {segment.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Intestazione dei giorni */}
            <div className="flex border-b border-rule">
              <div className="w-52 shrink-0 border-r border-rule px-3 py-2" />
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, var(--day))`,
                }}
              >
                {days.map((day, index) => {
                  const date = new Date(`${day}T00:00:00Z`);
                  const isWeekend = [0, 6].includes(date.getUTCDay());
                  const isToday = index === todayOffset;

                  return (
                    <div
                      key={day}
                      className={`py-2 text-center ${isWeekend ? "bg-sunk" : ""}`}
                    >
                      <div className="font-mono text-[0.6rem] uppercase text-faint">
                        {weekday.format(date)}
                      </div>
                      <div
                        className={`font-mono text-[0.7rem] tabular-nums ${
                          isToday
                            ? "font-medium text-accent"
                            : isWeekend
                              ? "text-faint"
                              : "text-muted"
                        }`}
                      >
                        {date.getUTCDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Una riga per oggetto */}
            {rows.map((row) => (
              <div key={row.id} className="flex border-b border-rule last:border-b-0">
                <div className="w-52 shrink-0 border-r border-rule px-3 py-2">
                  <div className="truncate text-[0.82rem] font-medium" title={row.name}>
                    {row.name}
                  </div>
                  {row.category && (
                    <div className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                      {row.category.name}
                    </div>
                  )}
                </div>

                <div
                  className="relative grid gap-y-0.5 py-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, var(--day))`,
                    gridAutoRows: "20px",
                  }}
                >
                  {/* Fondo: fine settimana e riga di oggi */}
                  {days.map((day, index) => {
                    const isWeekend = [0, 6].includes(
                      new Date(`${day}T00:00:00Z`).getUTCDay()
                    );
                    return (
                      <div
                        key={day}
                        aria-hidden="true"
                        className={`absolute inset-y-0 ${isWeekend ? "bg-sunk" : ""} ${
                          index === todayOffset
                            ? "border-l-2 border-accent"
                            : ""
                        }`}
                        style={{
                          left: `calc(${index} * var(--day))`,
                          width: "var(--day)",
                        }}
                      />
                    );
                  })}

                  {/* Le barre. Se due si sovrappongono, la griglia le impila
                      su righe successive invece di nasconderne una. */}
                  {row.bars.map((bar) => (
                    <Bar key={bar.id} {...bar} isAdmin={isAdmin} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showAll && rows.length < totalAssets && (
        <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-widest text-faint">
          {rows.length} / {totalAssets}
        </p>
      )}

      <SubscribeBox />
    </main>
  );
}

/* --------------------------------------------------------------- pezzi */

const BAR_STYLES: Record<OccupancyState, string> = {
  REQUESTED: "bg-sunk text-faint border border-dashed border-faint",
  RESERVED: "bg-held-bg text-held",
  IN_USE: "bg-out-bg text-out",
};

const BAR_LABELS = {
  REQUESTED: "state.requested",
  RESERVED: "state.reserved",
  IN_USE: "state.inUse",
} as const;

function Bar({
  requestId,
  state,
  offset,
  length,
  holder,
  isAdmin,
  continuesBefore,
  continuesAfter,
}: {
  requestId: string;
  state: OccupancyState;
  offset: number;
  length: number;
  holder: string | null;
  isAdmin: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
}) {
  const t = useT();
  const label = holder ? `${t(BAR_LABELS[state])} · ${holder}` : t(BAR_LABELS[state]);
  // Niente angolo arrotondato sul lato che continua fuori dalla finestra:
  // insieme alla freccia, dice a colpo d'occhio che la barra è tagliata, non
  // che il prestito finisce lì.
  const className = `relative z-10 flex items-center overflow-hidden px-1.5 ${BAR_STYLES[state]} ${
    continuesBefore ? "" : "rounded-l"
  } ${continuesAfter ? "" : "rounded-r"}`;
  const style = { gridColumn: `${offset + 1} / span ${length}` };
  const content = (
    <span className="truncate font-mono text-[0.6rem] uppercase tracking-wider">
      {continuesBefore && "‹ "}
      {label}
      {continuesAfter && " ›"}
    </span>
  );

  // Solo l'admin può aprire il dettaglio: al pubblico la barra resta un
  // rettangolo informativo, senza chi ce l'ha e senza dove andare.
  if (isAdmin) {
    return (
      <Link
        to={`/requests/${requestId}`}
        className={`${className} hover:ring-2 hover:ring-accent`}
        style={style}
        title={label}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className} style={style} title={label}>
      {content}
    </div>
  );
}

function Legend() {
  const t = useT();

  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      {(["REQUESTED", "RESERVED", "IN_USE"] as const).map((state) => (
        <span key={state} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block h-3 w-6 rounded ${BAR_STYLES[state]}`}
          />
          <span className="font-mono text-[0.68rem] uppercase tracking-wider text-muted">
            {t(BAR_LABELS[state])}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Salto diretto a un mese, per non dover cliccare «Dopo» molte volte per una
 * richiesta fra tre mesi. `key={days[0]}` nel chiamante rimonta il campo a
 * ogni cambio di finestra, così `defaultValue` torna a riflettere il mese
 * corrente invece di restare fermo sull'ultima scelta dell'utente.
 */
function MonthJump({ anchor, showAll }: { anchor: string; showAll: boolean }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{t("calendar.jumpToMonth")}</span>
      <input
        type="month"
        defaultValue={anchor.slice(0, 7)}
        onChange={(event) => {
          if (!event.target.value) return;
          navigate(`/calendar?from=${event.target.value}-01${showAll ? "&all=1" : ""}`);
        }}
        className="rounded border border-rule bg-card px-2 py-1 font-mono text-xs text-muted hover:text-ink focus:outline-2 focus:outline-offset-2 focus:outline-accent"
      />
    </label>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded border border-rule px-2.5 py-1 text-sm text-muted hover:border-accent hover:text-accent"
    >
      {children}
    </Link>
  );
}

/**
 * L'indirizzo da incollare in Google Calendar.
 *
 * Si costruisce nel browser da `location.origin`: dietro al tunnel Cloudflare
 * il server non conosce il dominio pubblico, e stamparlo dal lato server
 * darebbe a tutti un indirizzo `localhost` che non funziona per nessuno.
 */
function SubscribeBox() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Comincia vuoto anche nel browser: leggere `window.location` durante il
  // primo render darebbe un HTML diverso da quello mandato dal server (che
  // non conosce il dominio pubblico dietro al tunnel Cloudflare) e React
  // segnalerebbe un errore di hydration. Si riempie subito dopo, in un
  // effetto — stesso schema di `useCart` in use-cart.ts.
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/calendar.ics`);
  }, []);

  return (
    <section className="mt-10 rounded border border-rule bg-card p-5">
      <h2 className="text-sm font-semibold">{t("calendar.subscribe")}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        {t("calendar.subscribeHint")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-sunk px-3 py-2 font-mono text-xs">
          {url || "…"}
        </code>
        <button
          type="button"
          disabled={!url}
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="rounded border border-accent px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          {copied ? t("calendar.copied") : t("calendar.copy")}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ utilità */

function shiftDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

/** Il lunedì della settimana in cui cade la data. */
function startOfWeek(date: Date): Date {
  // getUTCDay(): domenica = 0. Lo trasformiamo in «giorni dopo lunedì».
  const offset = (date.getUTCDay() + 6) % 7;
  return shiftDays(date, -offset);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
