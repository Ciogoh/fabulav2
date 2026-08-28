/**
 * Il pezzo di Fabula che gira nel browser perché l'app si installi.
 *
 * Tre cose, tutte piccole e tutte senza interfaccia propria:
 *
 *  1. registra il service worker (`public/sw.js`);
 *  2. cattura l'evento con cui Android e i desktop offrono l'installazione —
 *     l'evento arriva **una volta sola** e va preso al volo, anche se la
 *     schermata che lo userà (`/account`) verrà aperta dieci minuti dopo;
 *  3. scrive il pallino col numero sull'icona dell'app.
 *
 * L'invito a installare non sta qui e non galleggia sopra alle pagine: vive
 * dentro a `/account`, accanto all'interruttore delle notifiche. Non è
 * pudore, è che su iPhone l'installazione **è il prerequisito** delle
 * notifiche — le due cose si spiegano insieme o non si spiegano — e perché in
 * fondo allo schermo c'è già la barra del carrello.
 */

import { useEffect, useSyncExternalStore } from "react";

/** L'evento di Chrome, che non sta in `lib.dom.d.ts` perché non è standard. */
type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/* ── Lo scaffale dove l'evento aspetta ────────────────────────────────────
   Un negozio esterno da quattro righe invece di uno stato React: chi lo
   riceve (questo componente, montato in `root`) e chi lo consuma
   (`/account`) non sono parenti, e passarselo da un contesto vorrebbe dire
   ridisegnare l'albero intero a ogni evento del browser. */
let deferred: InstallPromptEvent | null = null;
const watchers = new Set<() => void>();

function announce(): void {
  for (const watcher of watchers) watcher();
}

function subscribe(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

export function PwaRuntime({ badgeCount = 0 }: { badgeCount?: number }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    /* `register` fallisce da solo su http:// che non sia localhost, e quello
       è il caso di chi apre Fabula dall'indirizzo IP della macchina in rete
       locale: non è un guasto e non deve finire in console come un errore
       rosso, o si va a caccia di un problema che non c'è. */
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      if (import.meta.env.DEV) console.info("Service worker non registrato:", error);
    });
  }, []);

  useEffect(() => {
    function capture(event: Event) {
      // Senza `preventDefault` Chrome mostra la sua barra, e l'invito
      // finirebbe due volte sullo schermo.
      event.preventDefault();
      deferred = event as InstallPromptEvent;
      announce();
    }

    function installed() {
      deferred = null;
      announce();
    }

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  /* Il pallino sull'icona: lo stesso numero che il Centro mostra
     nell'intestazione, non un conto suo. Due numeri diversi per la stessa
     cosa, uno sull'icona e uno dentro, si contraddicono a vicenda e non si
     crede più a nessuno dei due.
     Esiste solo su Android e sui desktop, e solo quando l'app è installata:
     altrove il metodo non c'è e non si fa niente. */
  useEffect(() => {
    const badge = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!badge.setAppBadge) return;

    const promise =
      badgeCount > 0 ? badge.setAppBadge(badgeCount) : badge.clearAppBadge?.();
    // Su alcune combinazioni di sistema il permesso non c'è e la promessa
    // viene rifiutata: è un pallino, non deve rompere la pagina.
    promise?.catch(() => {});
  }, [badgeCount]);

  return null;
}

export type InstallState = {
  /** C'è un vero pulsante da premere (Android, Chrome desktop, Edge). */
  canPrompt: boolean;
  /** Siamo su iPhone o iPad, dove il pulsante non esiste e non esisterà. */
  isIos: boolean;
  /** Fabula è già aperta come app: l'invito non serve più a nessuno. */
  isInstalled: boolean;
};

/**
 * Lo stato dell'installazione, per la schermata che lo mostra.
 *
 * Tutto quanto si legge solo nel browser, quindi durante il render sul
 * server la risposta è «niente da fare»: è l'unico valore che non fa
 * lampeggiare l'interfaccia al momento dell'idratazione.
 */
export function useInstallState(): InstallState {
  const prompt = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null
  );

  const environment = useSyncExternalStore(
    // L'ambiente non cambia mentre la pagina è aperta — tranne il caso di
    // chi installa e continua a navigare nella scheda del browser, che
    // `appinstalled` copre già passando da `announce`.
    subscribe,
    readEnvironment,
    () => ({ isIos: false, isInstalled: false })
  );

  return {
    canPrompt: prompt !== null && !environment.isInstalled,
    isIos: environment.isIos,
    isInstalled: environment.isInstalled,
  };
}

/* Memorizzato perché `useSyncExternalStore` confronta i risultati con `===`:
   restituire un oggetto nuovo a ogni chiamata è un ciclo di render infinito. */
let environmentCache: { isIos: boolean; isInstalled: boolean } | null = null;

function readEnvironment(): { isIos: boolean; isInstalled: boolean } {
  const isIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // Da iPadOS 13 un iPad si presenta come un Mac. Lo smaschera il fatto
    // che un Mac vero non ha dieci punti di tocco.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isInstalled =
    window.matchMedia("(display-mode: standalone)").matches ||
    // La versione di Safari, che lo standard non l'ha mai adottato.
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (
    environmentCache &&
    environmentCache.isIos === isIos &&
    environmentCache.isInstalled === isInstalled
  ) {
    return environmentCache;
  }

  environmentCache = { isIos, isInstalled };
  return environmentCache;
}

/**
 * Apre la finestra di installazione del browser.
 *
 * Va chiamata da un click vero: l'evento si può usare **una volta sola**, e
 * dopo il browser ne manda un altro solo se e quando gli pare.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";

  const event = deferred;
  deferred = null;
  announce();

  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
