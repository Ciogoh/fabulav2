/*
 * Il service worker di Fabula.
 *
 * Scritto a mano e non con Workbox, per la stessa ragione per cui
 * `email.server.ts` chiama Resend con `fetch` invece della loro libreria:
 * sono un centinaio di righe, e una dipendenza che si aggiorna da sola sotto
 * a un file che decide *cosa finisce sul disco del telefono* non la paga.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  LA REGOLA, che qui è una regola di sicurezza e non una scelta di velocità
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Il service worker non mette MAI in cache una pagina né una risposta di
 *  loader. Solo `/assets/*` — che Vite firma con un'impronta nel nome, quindi
 *  non può servire una versione vecchia — più le icone e `offline.html`.
 *
 * Non è pigrizia. Una pagina di Fabula contiene `Asset.location`, le note
 * interne degli admin, i nomi veri di chi ha in prestito cosa. Metterla in
 * cache vuol dire lasciarla sul disco del telefono, leggibile dopo l'uscita e
 * dopo che a quella persona è stato tolto il ruolo di admin. La regola
 * «niente dati riservati nei loader pubblici» di CLAUDE.md verrebbe aggirata
 * dal basso, dal browser stesso, senza che nessuna riga di codice nostro
 * sembri sbagliata.
 *
 * Il prezzo è che Fabula senza rete non mostra il catalogo: mostra
 * `offline.html`. È il prezzo giusto.
 */

/* Cambiando questo numero si butta via tutta la cache vecchia al prossimo
   avvio. Va alzato quando cambia `PRECACHE`, non a ogni rilascio: i file di
   `/assets` sono già distinti dall'impronta nel nome. */
const CACHE = "fabula-v1";

/* Il minimo perché la pagina di cortesia si veda davvero quando non c'è
   rete: se dovesse scaricare qualcosa, non la vedrebbe nessuno. */
const PRECACHE = [
  "/offline.html",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // `skipWaiting` più `clients.claim` più sotto: un aggiornamento entra
      // alla ricarica successiva, senza il classico «nuova versione
      // disponibile» da disegnare e da gestire a mano.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Solo letture, e solo roba nostra. Una POST intercettata e rigiocata è il
  // modo migliore per approvare due volte la stessa richiesta.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Il flusso della chat (SSE, `app/routes/api.stream.tsx`) non è una
     richiesta che si possa mettere in cache né rigiocare: si passa e basta.
     Qui non è questione di cache — è che intercettare una risposta
     `text/event-stream` e ricostruirla interrompe il flusso, e si rompe nel
     modo peggiore da diagnosticare: la connessione sembra aperta e non arriva
     mai niente. */
  if (url.pathname === "/api/stream") return;

  /* I file firmati da Vite: il nome contiene l'impronta del contenuto, quindi
     una risposta in cache non può essere «vecchia» — se il contenuto cambia,
     cambia il nome. È l'unica famiglia di indirizzi per cui la cache è sicura
     per costruzione, ed è anche quella che pesa. */
  if (url.pathname.startsWith("/assets/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  /* Tutto il resto — documenti, `.data` dei loader, `/uploads/*`, le rotte
     risorsa — va in rete e basta. L'unica cosa che aggiungiamo è la cortesia:
     se la rete manca **e** si stava cercando di aprire una pagina, invece
     dell'errore del browser si vede `offline.html`.
     Le richieste che non sono navigazioni si lasciano fallire per conto loro:
     React Router sa già dire «non è riuscito», e una pagina HTML restituita
     al posto di un `.data` sarebbe un errore di parsing invece di un errore
     di rete. */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  }
});

/* ───────────────────────────────── notifiche ───────────────────────────── */

/**
 * Cosa può stare dentro a una notifica, che è una regola e non uno stile.
 *
 * Nel corpo non vanno nomi di persona né luoghi: una notifica si legge a
 * schermo bloccato, sul tavolo di un bar, in mezzo alla gente. È una
 * superficie semi-pubblica. Il testo lo compone il server
 * (`app/lib/notifications.server.ts`), ed è lì che la regola va rispettata:
 * qui si può solo non peggiorare le cose.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Una notifica malformata non deve restare muta: meglio un avviso vago
    // che nessun avviso, perché chi lo riceve può sempre aprire Fabula.
  }

  const title = payload.title || "Fabula";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      // `tag` uguale = la notifica nuova **sostituisce** la vecchia invece di
      // impilarsi. Il server ci mette l'id della richiesta: tre messaggi
      // nella stessa chat sono una riga sola nel centro notifiche, non tre.
      tag: payload.tag || undefined,
      data: { url: payload.url || "/" },
      // Su Android una notifica silenziosa e senza vibrazione passa
      // inosservata, ed è esattamente quello che si stava cercando di
      // risolvere passando dalle email.
      vibrate: [80, 40, 80],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  /* Se Fabula è già aperta da qualche parte, si porta a fuoco quella e la si
     manda sull'indirizzo giusto. Aprire una finestra nuova ogni volta lascia
     dietro una scia di schede identiche — ed è quello che fa il codice di
     esempio che si trova in giro. */
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin === target.origin && "focus" in client) {
            return client.focus().then((focused) =>
              focused.navigate ? focused.navigate(target.href) : focused
            );
          }
        }
        return self.clients.openWindow(target.href);
      })
  );
});

/**
 * Il browser ogni tanto ruota l'iscrizione da solo, senza dirlo a nessuno.
 *
 * Quando succede, la vecchia smette di funzionare e il server continua a
 * spedire nel vuoto finché non incassa un 410. Qui la si rifà e la si
 * consegna subito: la chiave del server si recupera dalla vecchia iscrizione,
 * perché il service worker non ha modo di leggere il `.env`.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription?.options?.applicationServerKey;
  if (!key) return;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((subscription) =>
        fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: "subscribe", subscription: subscription.toJSON() }),
        })
      )
      .catch(() => {
        // Niente da fare da qui: al prossimo accesso `/account` se ne accorge
        // e ripropone il pulsante.
      })
  );
});
