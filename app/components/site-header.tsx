/**
 * L'intestazione: il nome, i collegamenti, il selettore di lingua.
 *
 * Volutamente scarna. Chi arriva deve trovarsi davanti il catalogo, non una
 * barra di navigazione da studiare.
 *
 * ## Otto collegamenti non sono una barra, sono un elenco
 *
 * Con un admin la riga arrivava a otto voci tutte dello stesso peso, e su uno
 * schermo da 375px l'intestazione era alta **269px: un terzo dello schermo
 * prima di vedere un oggetto**, su quattro righe. Il `flex-wrap` aggiunto a
 * suo tempo aveva tolto lo scorrimento orizzontale, non il volume.
 *
 * Le otto voci però non pesano uguale, e la gerarchia era già scritta nel
 * prodotto: **il Centro è il lavoro di un turno** — ci si torna dieci volte
 * al giorno — mentre soci, oggetti, scanner e registro sono amministrazione,
 * dove si va quando si ha una cosa precisa da fare. Quindi il Centro resta
 * una voce in vista con la sua pastiglia, e le altre quattro entrano in un
 * menu solo (`ManageMenu`). **A ogni misura di schermo, non solo sul
 * telefono**: sul desktop otto collegamenti in fila si leggevano come otto
 * posti da controllare, che è lo stesso difetto che il Centro esiste per
 * togliere.
 *
 * Il nome della persona sparisce sotto ai 640px e resta l'avatar: da soli,
 * nome e ruolo prendevano metà larghezza per dire a qualcuno chi è lui.
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
import { displayNameOf } from "~/lib/person";
import { Logo } from "~/components/logo";
import type { Person } from "~/lib/person";
import { SKINS, type Skin } from "~/lib/skin";
import { THEMES, type Theme } from "~/lib/theme";

export type HeaderUser = Person & {
  email: string;
  isAdmin: boolean;
  /** Le tre voci del Centro. Solo per gli admin. */
  inbox?: { pending: number; unread: number; overdue: number };
  /** Quante delle proprie richieste hanno una risposta non ancora letta. */
  myUnreadCount: number;
};

/**
 * 44px: il minimo per un tocco affidabile, non i 36px che "ci stava il
 * pollice" lasciava intendere — vedi ITEM più sotto per la stessa misura.
 *
 * Due fatture, non una: la barra dell'admin resta sempre il fondo neutro
 * `--admin-bg` (in tutti e due gli stili), mentre la barra pubblica diventa
 * la fascia `--chrome-bg` nel Riso. `LINK_ADMIN` legge `--ink`/`--muted`,
 * che su un fondo chiaro leggono bene in entrambi gli stili; `LINK_CHROME`
 * legge `--chrome-ink`/`--chrome-muted`, pensati apposta per stare sopra
 * `--chrome-bg`. `InboxLink` e `ManageMenu` compaiono solo per gli admin,
 * quindi usano sempre `LINK_ADMIN`; i tre collegamenti sempre visibili
 * scelgono in base a `user?.isAdmin`.
 */
const LINK_ADMIN =
  "inline-flex min-h-11 items-center rounded-sm px-0.5 text-muted hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink";
const LINK_CHROME =
  "inline-flex min-h-11 items-center rounded-sm px-0.5 text-chrome-muted hover:text-chrome-ink aria-[current=page]:font-medium aria-[current=page]:text-chrome-ink";

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
    <NavLink to="/admin" className={LINK_ADMIN}>
      {t("nav.adminInbox")}
      {total > 0 && (
        <span
          aria-label={t("nav.adminInboxDetail", {
            pending: inbox?.pending ?? 0,
            unread: inbox?.unread ?? 0,
            overdue: inbox?.overdue ?? 0,
          })}
          className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-2xs font-medium ${
            hasOverdue ? "bg-out-bg text-out" : "bg-accent-soft text-accent"
          }`}
        >
          {total}
        </span>
      )}
    </NavLink>
  );
}

export function SiteHeader({
  user,
  theme,
  skin,
}: {
  user: HeaderUser | null;
  /** Per disegnare l'icona giusta e sapere dove va il prossimo tocco. Il
   * cambio vero resta un modulo verso `/theme`, come sempre — vedi
   * `ThemeCycleButton`. */
  theme: Theme;
  /** Per il selettore nel menu del profilo — vedi `SkinMenuSection`. */
  skin: Skin;
}) {
  const t = useT();
  // Il fondo dell'admin resta sempre neutro: solo la barra pubblica diventa
  // la fascia colorata nel Riso. Vedi la nota su `LINK_ADMIN`/`LINK_CHROME`.
  const chrome = !user?.isAdmin;
  const link = chrome ? LINK_CHROME : LINK_ADMIN;

  return (
    <header
      className={
        user?.isAdmin
          ? "border-b border-admin-rule bg-admin-bg"
          : "border-b border-chrome-rule bg-chrome-bg"
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <NavLink
          to="/"
          aria-label={t("app.name")}
          className={`inline-flex min-h-11 items-center ${chrome ? "text-chrome-ink" : "text-ink"}`}
        >
          {/* Il marchio vero al posto della scritta. Il punto colorato che
              stava qui era un surrogato del logo, fatto quando il logo non
              c'era; adesso c'è, e due segni d'identità accanto sono uno di
              troppo. Il nome del collegamento non si perde: sta
              nell'`aria-label` qui sopra — tradotto, come prima — quindi chi
              naviga a orecchio continua a sentire «Fabula» e non «immagine». */}
          <Logo className="h-6 w-auto" />
        </NavLink>

        {/* Sul telefono i collegamenti prendono una riga intera *sotto* al
            nome e al pulsante di uscita, invece di spingerli su una riga in
            più: l'intestazione era arrivata a 185px, cioè un quarto dello
            schermo prima di vedere un oggetto. */}
        <nav className="order-last flex w-full min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:order-none sm:w-auto">
          <NavLink to="/catalogue" className={link}>
            {t("nav.catalogue")}
          </NavLink>
          <NavLink to="/calendar" className={link}>
            {t("nav.calendar")}
          </NavLink>
          {user && (
            <NavLink to="/requests" className={link}>
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
              <ManageMenu />
            </span>
          )}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ThemeCycleButton theme={theme} chrome={chrome} />
          <LanguageMenu chrome={chrome} />

          {user ? (
            <ProfileMenu user={user} chrome={chrome} skin={skin} />
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
  "flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm text-muted hover:bg-sunk hover:text-ink";

/** Il ciclo del tema: dall'attuale al prossimo. `auto` è il punto di
 * partenza e il punto d'arrivo — un giro chiuso, non una linea. */
const NEXT_THEME: Record<Theme, Theme> = {
  auto: "light",
  light: "dark",
  dark: "auto",
};

const THEME_LABEL_KEY: Record<Theme, "nav.themeAuto" | "nav.themeLight" | "nav.themeDark"> = {
  auto: "nav.themeAuto",
  light: "nav.themeLight",
  dark: "nav.themeDark",
};

/**
 * Il tema, in cima, come un pulsante che cicla.
 *
 * Non un menu: un tocco solo che gira `auto → light → dark → auto`, come i
 * selettori di tema di un editor di codice. Il prezzo dichiarato è che da
 * `auto` a `dark` servono due tocchi e non si vede in anticipo dove si sta
 * andando — in cambio del controllo più piccolo possibile nella barra. Chi
 * preferisce vedere i tre nomi per esteso li trova nella sezione «Aspetto»
 * di `/account`, che resta invariata.
 *
 * Un modulo e un pulsante solo, come `LanguageMenu` e `routes/theme.tsx`:
 * funziona anche senza JavaScript, e la scelta che sta viaggiando si accende
 * subito da `fetcher.formData`, senza aspettare il giro dal server.
 */
function ThemeCycleButton({ theme, chrome }: { theme: Theme; chrome: boolean }) {
  const t = useT();
  const location = useLocation();
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("theme");
  const active = THEMES.find((name) => name === pending) ?? theme;
  const next = NEXT_THEME[active];

  return (
    <fetcher.Form method="post" action="/theme">
      <input
        type="hidden"
        name="redirectTo"
        value={location.pathname + location.search}
      />
      <button
        type="submit"
        name="theme"
        value={next}
        aria-label={t("nav.themeNext", { theme: t(THEME_LABEL_KEY[next]) })}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm ${
          chrome
            ? "text-chrome-muted hover:text-chrome-ink"
            : "text-muted hover:text-ink"
        }`}
      >
        <ThemeIcon theme={active} />
      </button>
    </fetcher.Form>
  );
}

/** Sole, luna, o le due insieme per l'automatico — lo stesso vocabolario di
 * icona che l'associazione già si aspetta da qualunque altro editor. */
function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.5" />
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6 3.5 3.5"
        />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          d="M13.5 9.35A5.75 5.75 0 0 1 6.65 2.5a5.75 5.75 0 1 0 6.85 6.85Z"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M8 1.5a6.5 6.5 0 1 0 0 13V1.5Z"
        fill="currentColor"
      />
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

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
function LanguageMenu({ chrome }: { chrome: boolean }) {
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
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-sm px-2 text-sm ${
          chrome
            ? "text-chrome-muted hover:text-chrome-ink aria-expanded:text-chrome-ink"
            : "text-muted hover:text-ink aria-expanded:text-ink"
        }`}
      >
        {/* «EN» è un'abbreviazione: da sola, un lettore di schermo la
            leggerebbe come una parola. Il nome del controllo viaggia
            nascosto accanto, ed è quello che viene annunciato. */}
        <span
          aria-hidden="true"
          className="font-mono text-2xs uppercase tracking-widest"
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
            className="min-w-36 rounded-sm border border-rule bg-card p-1 shadow-lg"
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
const SKIN_LABEL_KEY: Record<Skin, "account.skinClassic" | "account.skinRiso"> = {
  classic: "account.skinClassic",
  riso: "account.skinRiso",
};

/**
 * Classico o Riso, dentro al menu del profilo — non nella barra: è una
 * scelta che si tocca una volta ogni tanto, non a ogni pagina, e nella barra
 * pesava quanto la lingua senza servire quanto la lingua. La stessa scelta
 * sta anche nella sezione «Aspetto» di `/account`, per chi ci arriva
 * cercandola invece che scoprendola qui.
 *
 * Stessa fattura di `LanguageMenu`: un `fetcher.Form` per voce verso
 * `/skin`, `redirectTo` per tornare dov'eravamo, funziona senza JavaScript.
 */
function SkinMenuSection({ skin }: { skin: Skin }) {
  const t = useT();
  const location = useLocation();
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("skin");
  const active = SKINS.find((name) => name === pending) ?? skin;

  return (
    <fetcher.Form method="post" action="/skin">
      <input
        type="hidden"
        name="redirectTo"
        value={location.pathname + location.search}
      />
      <span className="block px-3 pt-2 pb-1 eyebrow">{t("account.skin")}</span>
      {SKINS.map((name) => (
        <button
          key={name}
          type="submit"
          name="skin"
          value={name}
          aria-current={name === active ? "true" : undefined}
          className={`${ITEM} ${name === active ? "font-medium text-ink" : ""}`}
        >
          {t(SKIN_LABEL_KEY[name])}
        </button>
      ))}
    </fetcher.Form>
  );
}

function ProfileMenu({
  user,
  chrome,
  skin,
}: {
  user: HeaderUser;
  chrome: boolean;
  skin: Skin;
}) {
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
        className={`flex min-h-11 items-center gap-2 rounded-sm px-1 text-sm ${
          chrome
            ? "text-chrome-muted hover:text-chrome-ink aria-expanded:text-chrome-ink"
            : "text-muted hover:text-ink aria-expanded:text-ink"
        }`}
      >
        <Avatar person={user} size="sm" />
        {/* Sotto ai 640px resta l'avatar: il proprio nome scritto per esteso
            nella barra è l'informazione che chi guarda ha meno bisogno di
            leggere, e su un telefono costava due voci di menu. Il nome del
            controllo non si perde — sta nel testo per soli lettori di
            schermo qui sotto. */}
        <span className="hidden sm:contents">
          <PersonName person={user} />
          {user.isAdmin && <AdminBadge />}
        </span>
        <span className="sr-only sm:hidden">{displayNameOf(user)}</span>
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
          <div className="min-w-44 rounded-sm border border-rule bg-card p-1 shadow-lg">
            <Link
              to="/account"
              className={ITEM}
              onClick={() => setOpen(false)}
            >
              {t("account.heading")}
            </Link>

            <SkinMenuSection skin={skin} />

            {/* Rosso solo al passaggio, come la variante `danger` del
                pulsante: l'uscita non è un allarme finché non la si sta
                davvero premendo. A bandiera a destra: è l'unica voce che fa
                uscire, e staccarla a destra la distingue da «Profilo» e
                «Pelle» senza bisogno di un colore o di una riga divisoria. */}
            <button
              type="button"
              className={`${ITEM} justify-end text-right hover:text-out`}
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


/**
 * Le quattro voci di amministrazione, raccolte in un menu.
 *
 * Non è una scorciatoia per far stare le cose: è la gerarchia che c'era già.
 * Soci, oggetti, scanner e registro sono posti in cui si va **con una cosa
 * precisa da fare** — aggiungere un socio, correggere una scheda, scoprire
 * chi ha segnato un ritiro — mentre il Centro è il lavoro che arriva da solo.
 * Tenerli in fila con lo stesso peso faceva sembrare otto le cose da
 * controllare a ogni apertura, e ne rimane una.
 *
 * Il pulsante si accende quando si è dentro a una di quelle pagine
 * (`aria-current`): un menu chiuso che non dice «sei qui dentro» è un modo
 * per non sapere più dove si è. Stessa disclosure degli altri due — Escape,
 * click fuori, fuoco che esce col Tab — quindi qui non si ripete il perché.
 */
const MANAGE = [
  { to: "/admin/members", key: "nav.adminMembers" },
  { to: "/admin/assets", key: "nav.adminAssets" },
  { to: "/admin/scan", key: "nav.adminScan" },
  { to: "/admin/log", key: "nav.adminLog" },
  { to: "/admin/landing", key: "nav.adminLanding" },
] as const;

function ManageMenu() {
  const t = useT();
  const location = useLocation();
  const { open, setOpen, wrapRef, triggerRef, openedByHover } = useDisclosure();
  const inside = MANAGE.some((entry) => location.pathname.startsWith(entry.to));

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
        aria-current={inside ? "true" : undefined}
        onClick={() => setOpen((was) => (openedByHover.current ? true : !was))}
        className={`${LINK_ADMIN} gap-1 aria-expanded:text-ink`}
      >
        {t("nav.adminManage")}
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
        <div className="absolute left-0 top-full z-20 pt-2">
          <div className="min-w-44 rounded-sm border border-rule bg-card p-1 shadow-lg">
            {MANAGE.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                className={`${ITEM} aria-[current=page]:font-medium aria-[current=page]:text-ink`}
                onClick={() => setOpen(false)}
              >
                {t(entry.key)}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
