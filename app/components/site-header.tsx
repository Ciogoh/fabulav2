/**
 * L'intestazione: il nome, i collegamenti, il selettore di lingua.
 *
 * Volutamente scarna. Chi arriva deve trovarsi davanti il catalogo, non una
 * barra di navigazione da studiare.
 *
 * Due difetti veri, corretti qui:
 *
 * - Il `<nav>` era `flex` senza `flex-wrap`. Con i sei collegamenti di un
 *   admin diventava largo 466px dentro a uno schermo da 375: **l'intera
 *   pagina scorreva in orizzontale**, gli ultimi due collegamenti restavano
 *   fuori, e il foglio della richiesta — largo quanto la pagina, non quanto
 *   lo schermo — finiva storto e tagliato. Tutto da una riga di CSS.
 * - Nessun collegamento diceva dove sei. Ora è `NavLink`, che mette da solo
 *   `aria-current="page"`: lo vedono sia l'occhio sia il lettore di schermo.
 */

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useFetcher, useLocation, useNavigate } from "react-router";
import { LANGUAGE_NAMES, LANGUAGES } from "~/i18n/dictionaries";
import { useLang, useT } from "~/i18n/use-t";
import { authClient } from "~/lib/auth-client";
import { ButtonLink } from "~/components/button";
import { AdminBadge } from "~/components/admin-badge";
import { Avatar, PersonName } from "~/components/person";
import type { Person } from "~/lib/person";

export type HeaderUser = Person & {
  email: string;
  isAdmin: boolean;
  /** Le tre voci del Centro. Solo per gli admin. */
  inbox?: { pending: number; unread: number; overdue: number };
  /** Quante delle proprie richieste hanno una risposta non ancora letta. */
  myUnreadCount: number;
};

/** 44px: il minimo per un tocco affidabile, non i 36px che "ci stava il
 * pollice" lasciava intendere — vedi ITEM più sotto per la stessa misura. */
const LINK =
  "inline-flex min-h-11 items-center rounded px-0.5 text-muted hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink";

/**
 * Il Centro, con una pastiglia sola.
 *
 * Erano due voci e due numeri — «da approvare» e «in ritardo» — e i messaggi
 * non letti non comparivano affatto. Tre segnali separati sulla stessa barra
 * si leggono come tre posti da controllare, che è esattamente il difetto che
 * il Centro esiste per togliere.
 *
 * Il numero è la somma; il colore dice se dentro c'è un ritardo, perché una
 * richiesta in attesa è normale amministrazione e un oggetto che non torna è
 * un problema. **Un numero nudo non dice di cosa**, quindi il dettaglio per
 * esteso va nell'`aria-label`: è l'unico posto in cui «3» può diventare «3 da
 * approvare, 1 in ritardo» senza allargare la barra.
 */
function InboxLink({ inbox }: { inbox: HeaderUser["inbox"] }) {
  const t = useT();
  const total = inbox ? inbox.pending + inbox.unread + inbox.overdue : 0;
  const hasOverdue = Boolean(inbox?.overdue);

  return (
    <NavLink to="/admin" className={LINK}>
      {t("nav.adminInbox")}
      {total > 0 && (
        <span
          aria-label={t("nav.adminInboxDetail", {
            pending: inbox?.pending ?? 0,
            unread: inbox?.unread ?? 0,
            overdue: inbox?.overdue ?? 0,
          })}
          className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[0.65rem] font-medium ${
            hasOverdue ? "bg-out-bg text-out" : "bg-accent-soft text-accent"
          }`}
        >
          {total}
        </span>
      )}
    </NavLink>
  );
}

export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const t = useT();

  return (
    <header
      className={
        user?.isAdmin
          ? "border-b border-admin-rule bg-admin-bg"
          : "border-b border-rule bg-card"
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <NavLink
          to="/"
          className="font-serif text-2xl font-semibold tracking-tight text-ink"
        >
          {t("app.name")}
          <span className="text-accent">.</span>
        </NavLink>

        {/* Sul telefono i collegamenti prendono una riga intera *sotto* al
            nome e al pulsante di uscita, invece di spingerli su una riga in
            più: l'intestazione era arrivata a 185px, cioè un quarto dello
            schermo prima di vedere un oggetto. */}
        <nav className="order-last flex w-full min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:order-none sm:w-auto">
          {/* `end` sul catalogo: senza, la rotta indice risulterebbe attiva
              su ogni pagina, perché ogni percorso comincia per "/". */}
          <NavLink to="/" end className={LINK}>
            {t("nav.catalogue")}
          </NavLink>
          <NavLink to="/calendar" className={LINK}>
            {t("nav.calendar")}
          </NavLink>
          {user && (
            <NavLink to="/requests" className={LINK}>
              {t("nav.myRequests")}
              {/* Il segnale che a chi chiede in prestito è sempre mancato:
                  «ti hanno risposto». Un pallino e non un numero — quante
                  siano non cambia cosa fare, e un numero accanto a due voci di
                  menu diverse si legge come lo stesso conteggio. */}
              {user.myUnreadCount > 0 && (
                <span
                  aria-label={t("nav.myRequestsUnread")}
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
                />
              )}
            </NavLink>
          )}

          {user?.isAdmin && (
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="hidden h-4 w-px bg-admin-rule sm:inline-block" />
              <InboxLink inbox={user.inbox} />
              <NavLink to="/admin/members" className={LINK}>
                {t("nav.adminMembers")}
              </NavLink>
              <NavLink to="/admin/assets" className={LINK}>
                {t("nav.adminAssets")}
              </NavLink>
              <NavLink to="/admin/scan" className={LINK}>
                {t("nav.adminScan")}
              </NavLink>
              <NavLink to="/admin/log" className={LINK}>
                {t("nav.adminLog")}
              </NavLink>
            </span>
          )}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <LanguageMenu />

          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <ButtonLink to="/signin" variant="secondary" size="md">
              {t("nav.signIn")}
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Apertura/chiusura condivisa fra i due menu dell'intestazione (lingua e
 * profilo): hover solo da mouse vero, Escape, click fuori, fuoco che esce
 * col Tab chiude. Estratta da qui perché prima viveva solo dentro
 * `ProfileMenu` — vedi lì il perché di ogni pezzo, non ripetuto due volte.
 */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /* Aperto dal passaggio del mouse, non da una pressione. Serve al `onClick`
     di chi usa questo hook: col mouse sopra, il menu è **già** aperto quando
     arriva il click, e un semplice «apri/chiudi» lo richiuderebbe
     nell'istante in cui lo si preme. Col dito e da tastiera il passaggio non
     esiste, questo resta falso, e il click torna a essere un interruttore. */
  const openedByHover = useRef(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    /* `pointerdown` e non `click`: chi preme fuori si aspetta che il menu sia
       già sparito quando alza il dito, e il click che arriva dopo deve finire
       su quello che ha premuto, non essere consumato per chiudere. */
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return { open, setOpen, wrapRef, triggerRef, openedByHover };
}

/** Una voce del menu: alta 44px, larga quanto il pannello. Un elenco di righe
 * alte venti pixel, in magazzino col pollice, si sbaglia. */
const ITEM =
  "flex min-h-11 w-full items-center rounded px-3 text-left text-sm text-muted hover:bg-sunk hover:text-ink";

/**
 * La lingua, raccolta in un pulsante solo invece di tre sempre in vista.
 *
 * Erano tre `<button>` da 36×36px con 2px fra loro — sotto ai minimi di
 * tocco comuni (44px Apple, 48px Google), e con quel poco spazio un vero
 * rischio di premere quella sbagliata. Comprimerli ha senso perché la
 * scelta **si salva** (cookie e, per chi ha un account, anche sul profilo —
 * vedi `routes/language.tsx`): si tocca quasi solo la prima volta, non serve
 * tenerla sempre visibile in tre pezzi.
 *
 * Stessa disclosure di `ProfileMenu` (`useDisclosure`), stesso
 * `fetcher.Form` di prima per il submit: il browser manda solo il valore del
 * pulsante premuto, quindi la lingua cambia anche senza JavaScript, e la
 * lingua premuta si accende subito senza aspettare il server —
 * `fetcher.formData` contiene già quella che sta viaggiando.
 */
function LanguageMenu() {
  const t = useT();
  const lang = useLang();
  const location = useLocation();
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("lang");
  // Quella che sta viaggiando vince su quella confermata dal server.
  const active =
    LANGUAGES.find((code) => (pending ? code === pending : code === lang)) ??
    lang;
  const { open, setOpen, wrapRef, triggerRef, openedByHover } =
    useDisclosure();

  /* Il pannello si chiude quando l'invio è *davvero* partito, non nello
     stesso click che lo scatena. Chiudere nell'`onClick` del pulsante
     smonterebbe il bottone — e la form intorno — nello stesso istante in cui
     il browser deve ancora processare l'invio nativo: su Safari (mobile
     compreso) questo può far saltare l'invio in silenzio, perché l'elemento
     che l'ha innescato non esiste già più. `fetcher.state` passa a
     "submitting" solo dopo che React Router ha già catturato l'invio, quindi
     a quel punto smontare è sicuro. */
  useEffect(() => {
    if (fetcher.state !== "idle") setOpen(false);
  }, [fetcher.state, setOpen]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        openedByHover.current = true;
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        openedByHover.current = false;
        setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => (openedByHover.current ? true : !was))}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-2 text-sm text-muted hover:text-ink aria-expanded:text-ink"
      >
        {/* «EN» è un'abbreviazione: da sola, un lettore di schermo la
            leggerebbe come una parola. Il nome del controllo viaggia
            nascosto accanto, ed è quello che viene annunciato. */}
        <span
          aria-hidden="true"
          className="font-mono text-[0.7rem] uppercase tracking-widest"
        >
          {active}
        </span>
        <span className="sr-only">{t("nav.language")}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 pt-2">
          <fetcher.Form
            method="post"
            action="/language"
            aria-label={t("nav.language")}
            className="min-w-36 rounded border border-rule bg-card p-1 shadow-lg"
          >
            {/* Torniamo esattamente dove eravamo, filtri di ricerca compresi. */}
            <input
              type="hidden"
              name="redirectTo"
              value={location.pathname + location.search}
            />
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="submit"
                name="lang"
                value={code}
                aria-current={code === active ? "true" : undefined}
                className={`${ITEM} ${code === active ? "font-medium text-ink" : ""}`}
              >
                {LANGUAGE_NAMES[code]}
              </button>
            ))}
          </fetcher.Form>
        </div>
      )}
    </div>
  );
}

/**
 * Il proprio nome apre un menu, non una pagina.
 *
 * «Esci» era un pulsante fisso accanto al nome: l'azione più rara
 * dell'intestazione con il peso visivo della più frequente, e la prima cosa
 * che l'occhio incontra arrivando da destra. Ora sta dentro al menu insieme al
 * profilo, e nella barra restano solo cose che si usano davvero.
 *
 * **Si apre premendo, e anche col passaggio del mouse dove il mouse c'è
 * davvero.** La guardia è `pointerType === "mouse"`: sul telefono un tocco
 * genera *anche* un `pointerenter`, quindi senza quel controllo il menu si
 * aprirebbe al tocco e il click subito dopo lo richiuderebbe — il difetto
 * classico dei menu a scomparsa portati sul telefono.
 *
 * **Fra il nome e il pannello non c'è vuoto.** Lo spazio che si vede è
 * `pt-2` *dentro* al contenitore del pannello, non un margine: se fosse un
 * margine, il puntatore che scende da «Samu» verso «Esci» uscirebbe per un
 * istante da tutte e due le caselle e il menu si chiuderebbe proprio mentre lo
 * si sta per usare.
 *
 * È una disclosure, non un `role="menu"`: dentro ci sono un collegamento e un
 * pulsante veri, quindi il tasto Tab li attraversa da solo e non serve
 * reimplementare le frecce. Esc chiude e riporta il fuoco sul nome; uscire col
 * Tab chiude pure, o resterebbe aperto un pannello che nessuno sta guardando.
 *
 * Il fuoco *non* è imprigionato dentro, a differenza del foglio della
 * richiesta: quello è un dialogo che copre la pagina, questo è un menu che ci
 * si appoggia sopra. Intrappolare il fuoco qui significherebbe non poter più
 * uscire col Tab.
 */
function ProfileMenu({ user }: { user: HeaderUser }) {
  const t = useT();
  const navigate = useNavigate();
  const { open, setOpen, wrapRef, triggerRef, openedByHover } =
    useDisclosure();

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        openedByHover.current = true;
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        openedByHover.current = false;
        setOpen(false);
      }}
      // Il fuoco che se ne va con Tab chiude: `relatedTarget` è dove sta
      // andando, e se non è qui dentro il menu non serve più a nessuno.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => (openedByHover.current ? true : !was))}
        className="flex min-h-11 items-center gap-2 rounded px-1 text-sm text-muted hover:text-ink aria-expanded:text-ink"
      >
        <Avatar person={user} size="sm" />
        <PersonName person={user} />
        {user.isAdmin && <AdminBadge />}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 pt-2">
          <div className="min-w-44 rounded border border-rule bg-card p-1 shadow-lg">
            <Link
              to="/account"
              className={ITEM}
              onClick={() => setOpen(false)}
            >
              {t("account.heading")}
            </Link>

            {/* Rosso solo al passaggio, come la variante `danger` del
                pulsante: l'uscita non è un allarme finché non la si sta
                davvero premendo. */}
            <button
              type="button"
              className={`${ITEM} hover:text-out`}
              onClick={() =>
                // `navigate` e non un ricaricamento: il loader di root rilegge
                // la sessione e l'intestazione si aggiorna da sola.
                void authClient
                  .signOut()
                  .then(() => navigate("/", { replace: true }))
              }
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
