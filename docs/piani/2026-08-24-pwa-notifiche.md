# Fabula come PWA installabile, con le notifiche al posto delle email

## Contesto

Oggi ogni avviso di Fabula è un'email: nuova richiesta agli admin, decisione a
chi ha chiesto, annullamento, consegna diretta, promemoria di riconsegna. Sono
cinque messaggi che vivono tutti in `app/lib/notifications.server.ts` e che
partono da sei punti di chiamata soltanto.

Il problema pratico è quello che hai descritto: gli admin sono volontari che si
alternano, e ogni richiesta riempie la casella di **tutti** quelli che stanno
in `ADMIN_EMAILS`. Chi vuole essere avvisato sul telefono, senza posta, oggi non
può sceglierlo.

L'obiettivo è duplice e le due metà sono indipendenti:

1. **Fabula si installa** — icona sul telefono, finestra senza barra del
   browser, si apre come un'app.
2. **Ogni persona sceglie il canale** nel proprio profilo: email, notifiche
   dell'app, o entrambe. Chi sceglie solo le notifiche smette di ricevere le
   email di prestito.

`CLAUDE.md` già registra la PWA come passo numero 2, dopo l'allineamento
visivo. Questo piano è quel passo, scritto per intero.

---

## Prerequisito dichiarato: prima il rebrand

**Scelta presa: il rebrand a Material Matters viene prima.** L'icona 192, la
512, la versione *maskable*, la `apple-touch-icon` da 180 e il `theme_color`
della barra di sistema sono materiale di marca: farli sul blu-inchiostro
attuale significa rifarli tutti fra un mese.

Il lavoro sotto comincia quindi a rebrand finito. Le Parti 2 e 3 (le notifiche)
non dipendono da nessun colore e potrebbero partire prima, se cambi idea.

---

## Fino a che punto diventa una vera app

La parte onesta del piano, perché è la domanda che hai fatto.

**Si ottiene davvero:**

- Icona propria sulla schermata Home, su iPhone, Android e desktop.
- Finestra a schermo intero senza la barra degli indirizzi, con schermata di
  avvio.
- Notifiche di sistema vere: arrivano a schermo bloccato, con suono, anche
  quando Fabula è chiusa. Toccandole si apre la richiesta giusta.
- Il pallino con il numero sull'icona per gli admin che hanno richieste in
  attesa (`navigator.setAppBadge`; il conteggio esiste già nel loader radice).
- Avvio istantaneo: i file di interfaccia stanno in cache, non si riscaricano.

**Non si ottiene, e non è una svista:**

- **Presenza sull'App Store o sul Play Store.** Servirebbe un involucro
  (PWABuilder, Capacitor), un account sviluppatore Apple a 99 $/anno e una
  revisione a ogni versione. Per uno strumento interno a un'associazione non
  vale il prezzo — e se un giorno servisse, la PWA fatta ora è esattamente il
  materiale di partenza.
- **Uso serio senza rete.** Vedi *La regola della cache* più sotto: le pagine
  di Fabula non si mettono in cache di proposito. Senza rete si vede una pagina
  di cortesia, non il catalogo.
- **Su iPhone, le notifiche senza installare.** È un vincolo di Apple, non
  nostro. Vedi il capitolo dei problemi.

---

## Parte 1 — Il guscio installabile

Nessuna dipendenza nuova, nessun database.

**File nuovi:**

- `public/manifest.webmanifest` — `name`, `short_name: "Fabula"`,
  `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color` e
  `theme_color` presi dai token definitivi di `app/app.css`, e le icone.
- `public/icons/` — 192, 512, 512 *maskable* (con il margine di sicurezza del
  20% richiesto da Android) e `apple-touch-icon-180.png` **senza trasparenza**,
  che iOS annerisce.
- `scripts/icons.ts` — genera tutte le misure da un SVG sorgente con `sharp`,
  che è già una dipendenza del progetto (`uploads.server.ts`). Rigenerare le
  icone diventa un comando, non un pomeriggio in un editor grafico.
- `public/offline.html` — pagina di cortesia autosufficiente, stili in linea,
  perché quando la si vede non c'è rete per scaricare il foglio di stile.
- `public/sw.js` — il *service worker*, scritto a mano (vedi sotto).

**File modificati:**

- `app/root.tsx`: `links()` guadagna `{ rel: "manifest" }` e
  `{ rel: "apple-touch-icon" }`; dentro `Layout` vanno i due `<meta>` che iOS
  legge (`apple-mobile-web-app-capable`, `apple-mobile-web-app-title`) e
  `theme-color`.
- `app/components/pwa.tsx` (nuovo): registra il service worker in un `useEffect`
  guardato da `"serviceWorker" in navigator`, e ospita il suggerimento di
  installazione. Montato una volta in `App`.

**Il suggerimento di installazione, due strade diverse:**

- Android e desktop mandano l'evento `beforeinstallprompt`: lo si intercetta e
  si mostra un pulsante «Installa» vero.
- iOS non lo manda e non lo manderà. Serve un pannellino con le istruzioni —
  «Condividi → Aggiungi alla schermata Home» — mostrato solo se il browser è
  Safari su iOS **e** la finestra non è già in modalità autonoma
  (`window.matchMedia("(display-mode: standalone)")`). Da chiudere e non
  rivedere più: una preferenza in `localStorage`.

### La regola della cache, che qui è una regola di sicurezza

Il service worker è scritto a mano e non con Workbox, per la stessa ragione per
cui `email.server.ts` chiama Resend con `fetch` invece della loro libreria:
sono sessanta righe e una dipendenza non le paga.

La regola vale più della quantità di righe:

> **Il service worker non mette mai in cache una pagina né una risposta di
> loader.** Solo `/assets/*` — che Vite firma con un'impronta nel nome, quindi
> non può servire una versione vecchia — più le icone e `offline.html`.

Non è pigrizia: una pagina di Fabula contiene `Asset.location`, `adminNotes`,
i nomi veri di chi ha in prestito cosa. Metterla in cache significa lasciarla
sul disco del telefono, leggibile dopo l'uscita e dopo un cambio di ruolo. La
regola «niente dati riservati nei loader pubblici» di `CLAUDE.md` verrebbe
aggirata dal basso, dal browser stesso.

Quindi: documenti e richieste `.data` sempre dalla rete, con `offline.html`
come ripiego quando la rete manca; `/assets/*` dalla cache; tutto il resto
ignorato dal service worker.

Chiave di versione nella cache più `skipWaiting` e `clients.claim`, così un
aggiornamento entra alla ricarica successiva senza il classico «nuova versione
disponibile» da gestire a mano. `react-router-serve` serve i file di `public/`
con `max-age=0` ed ETag (`express.static` senza `maxAge`, riga 119 del suo
`cli.js`), quindi `sw.js` non resta bloccato in una cache lunga: verificato,
non assunto.

---

## Parte 2 — Il motore delle notifiche push

**Una dipendenza nuova: `web-push`.** Qui la libreria si paga da sola, al
contrario del caso Resend: una notifica push va cifrata da capo a fondo con
ECDH e `aes128gcm`, e la chiave del server firmata come JWT VAPID. È crittografia
vera, non una `POST` con un token. Scriverla a mano sarebbe il tipo di codice
che sembra funzionare finché non funziona.

**Chiavi**, generate una volta con `npx web-push generate-vapid-keys` e messe
in `.env` e `.env.example`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT` (un `mailto:`). Vanno nel backup insieme al dump: **cambiarle
invalida ogni iscrizione esistente** e obbliga tutti a riattivare le notifiche.
Riga da aggiungere in `scripts/backup.sh` e nel capitolo backup di `CLAUDE.md`.

**Schema** (`prisma/schema.prisma`, migrazione con la skill `prisma-migration`
— `prisma migrate dev` diretto fallisce in questo ambiente):

```prisma
enum NotifyChannel { EMAIL  PUSH  BOTH }

model User {
  // …
  notifyChannel     NotifyChannel      @default(EMAIL)
  pushSubscriptions PushSubscription[]
}

/// Un'iscrizione per dispositivo, non per persona: il telefono e il portatile
/// sono due righe. `endpoint` è l'indirizzo che il servizio push del browser
/// ci dà, ed è unico per costruzione.
model PushSubscription {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint      String   @unique
  p256dh        String
  auth          String
  /// Solo per far riconoscere il dispositivo nell'elenco del profilo.
  userAgent     String?
  createdAt     DateTime @default(now())
  lastSuccessAt DateTime?

  @@index([userId])
}
```

**`app/lib/push.server.ts`** (nuovo) — il gemello di `email.server.ts`, stessa
forma:

- `sendPush(userId, { title, body, url })` → recupera le iscrizioni della
  persona, cifra e spedisce a tutte in parallelo.
- **Le iscrizioni morte si cancellano da sole**: un `404` o `410` dal servizio
  push significa che quel dispositivo non esiste più (app disinstallata, dati
  del browser puliti) — la riga si elimina. Senza questa pulizia la tabella si
  riempie di indirizzi che falliscono per sempre.
- Restituisce quante notifiche sono davvero partite. Serve alla Parte 3.
- Come per le email, un errore non deve mai far fallire l'azione che l'ha
  innescata.

**`app/routes/api.push.tsx`** (nuovo, rotta risorsa) — `requireUser` in prima
riga, tre intenti: `subscribe`, `unsubscribe`, `test`. La chiave pubblica VAPID
viaggia nel loader di `/account`, dove serve.

**Handler nel service worker**: `push` mostra la notifica, `notificationclick`
riporta a fuoco una finestra di Fabula già aperta e la manda sull'URL della
notifica, oppure ne apre una nuova.

**Cosa scrivere dentro una notifica** — regola nuova, da mettere in `CLAUDE.md`:

> Nel corpo di una notifica push non vanno nomi di persona né luoghi. Una
> notifica si legge a schermo bloccato, in mezzo alla gente: è una superficie
> semi-pubblica. «Fabula · Nuova richiesta — 3 oggetti, 20–25 ago» basta; chi
> ha chiesto si vede aprendo.

È la stessa regola per cui il catalogo dice che un oggetto è occupato ma non
da chi.

---

## Parte 3 — La scelta nel profilo, e chi riceve cosa

### La regola che tiene tutto in piedi

> **La preferenza vale solo per gli avvisi di prestito.** Codice di accesso,
> reimposta password e comunicazioni importanti sulla piattaforma restano
> email, sempre, per chiunque.

Il confine esiste già nel codice e va solo dichiarato: `email.server.ts` è il
postino grezzo che usano l'accesso e Better Auth; `notifications.server.ts` è
il ciclo di vita di una richiesta, ed **è l'unico posto che consulta la
preferenza**. Una notifica push che non arriva è un fastidio; un codice di
accesso che non arriva chiude fuori una persona dalla piattaforma.

### Il dispatcher

Dentro `notifications.server.ts` nasce una funzione sola,
`deliver(recipient, { subject, text, push })`, e le cinque funzioni esistenti
passano da lì invece di chiamare `sendEmail` direttamente:

- canale `EMAIL` o `BOTH` → email;
- canale `PUSH` o `BOTH` → push;
- **canale `PUSH` ma nessuna notifica partita davvero → email lo stesso.** È la
  rete di sicurezza che rende la funzione affidabile: se il telefono ha perso
  l'iscrizione, l'avviso non sparisce in silenzio. Senza questa riga, una
  richiesta può restare mesi in coda senza che nessuno lo sappia.

### I destinatari degli avvisi agli admin

Oggi `notifyAdminsNewRequest` scrive a `adminEmails()`, cioè a una lista fissa
nel `.env`. Una lista di indirizzi non ha preferenze, quindi va cambiata:

- I destinatari diventano **gli utenti con ruolo `ADMIN`** letti dal database,
  ciascuno sul canale che ha scelto.
- `ADMIN_EMAILS` **resta**, per la casella condivisa dell'associazione o per
  chi vuole l'avviso senza avere un account. Ma gli indirizzi di quella lista
  che corrispondono all'email di un admin registrato **vengono scartati**:
  altrimenti chi ha scelto «solo notifiche» continuerebbe a ricevere la posta
  dalla porta di servizio, che è esattamente il problema da risolvere.

### La schermata

Una sezione nuova in `app/routes/account.tsx`, sotto al nome, che rispetta
`components/select.tsx` e `components/button.tsx` (regola 7, un pulsante solo,
un guscio solo):

- il menu a tendina con le tre scelte;
- il pulsante «Attiva le notifiche su questo dispositivo» — deve partire da un
  gesto vero della persona, è un requisito dei browser, non un dettaglio di
  stile;
- l'elenco dei dispositivi iscritti, con la data e un modo per togliere quello
  corrente. La preferenza è della persona, l'iscrizione è del dispositivo: chi
  ha telefono e portatile deve vedere due righe e capire perché;
- **«Manda una notifica di prova»**, che vale da sola metà del capitolo di
  verifica: senza, per sapere se funziona bisogna aspettare che qualcuno faccia
  una richiesta;
- i tre stati che il permesso può avere: mai chiesto, concesso, **negato** — e
  quest'ultimo non si può riaprire dal web. Il testo deve dire dove andare
  nelle impostazioni del sistema, altrimenti la persona preme un pulsante che
  non fa niente e conclude che è rotto.

Le chiavi di traduzione (una ventina, per tre lingue) si aggiungono con la
skill `add-i18n-key`; `pnpm typecheck` fallisce se ne manca una.

---

## I problemi veri

**1. iPhone, ed è il vincolo che decide tutto.** Le notifiche web su iOS
esistono dal 16.4, ma **solo** se Fabula è stata aggiunta alla schermata Home.
Nessun avviso automatico, nessun pulsante «installa»: la persona deve toccare
Condividi e poi Aggiungi. In pratica, per gli admin con iPhone la PWA non è
un'opzione fra le altre, è il prerequisito — e le prime volte va spiegata a
voce. Il pannellino con le istruzioni serve a questo. Se il permesso viene
negato una volta, non si può richiedere dal sito: si passa dalle impostazioni
di iOS.

**2. Le iscrizioni push muoiono in silenzio.** Pulizia dei dati del browser,
icona rimossa dalla Home, mesi di inattività su iOS. Il dispositivo smette di
ricevere e nessuno se ne accorge. Due difese, ed è la ragione per cui sono nel
piano dal primo giorno: la cancellazione automatica sul `404`/`410` e il
ripiego sull'email quando non parte niente.

**3. La chiave VAPID è un segreto con memoria.** Rigenerarla scollega tutti i
dispositivi, tutti insieme, senza avviso. Va nel backup e nella
documentazione, accanto al `SESSION_SECRET`.

**4. La cache di un'app con dati riservati.** Trattata sopra: nessuna pagina in
cache, mai. È la scelta che rende la PWA meno impressionante offline e molto
più difendibile.

**5. Il canale scelto e la fretta.** Se domani gli avvisi diventano dieci al
giorno, le notifiche danno più fastidio delle email — sono interruzioni. Per
questo la scelta parte da `EMAIL` come valore predefinito: chi vuole le
notifiche le accende, non se le trova addosso.

**6. Accesso con Google dentro alla finestra autonoma.** Su iPhone una PWA
installata ha uno spazio dati suo, separato da Safari: il giro di Google va
provato *dopo* l'installazione, non solo nel browser. Il codice via email —
che è il modo principale di entrare in Fabula — non ha questo problema, ed è un
buon motivo per lasciarlo primo.

---

## File toccati, in breve

| Nuovi | |
| --- | --- |
| `public/manifest.webmanifest`, `public/icons/*`, `public/offline.html` | il guscio |
| `public/sw.js` | cache di `/assets`, `push`, `notificationclick` |
| `scripts/icons.ts` | icone da un SVG, con `sharp` |
| `app/components/pwa.tsx` | registrazione + suggerimento di installazione |
| `app/lib/push.server.ts` | gemello di `email.server.ts` |
| `app/routes/api.push.tsx` | iscrizione, disiscrizione, prova |

| Modificati | |
| --- | --- |
| `app/root.tsx` | `links()`, i `<meta>` di iOS, il pallino sull'icona |
| `app/routes.ts` | la rotta `api/push` |
| `prisma/schema.prisma` | `NotifyChannel`, `User.notifyChannel`, `PushSubscription` |
| `app/lib/notifications.server.ts` | `deliver()`, e le cinque funzioni che ci passano |
| `app/lib/email.server.ts` | `adminEmails()` diventa «gli indirizzi in più» |
| `app/routes/account.tsx` | la sezione delle notifiche |
| `app/i18n/dictionaries.ts` | ~20 chiavi × 3 lingue |
| `.env.example`, `scripts/backup.sh`, `CLAUDE.md` | chiavi VAPID e le due regole nuove |

I sei punti di chiamata da adattare, che sono pochi ed è la ragione per cui il
lavoro è contenuto: `routes/requests.tsx:160`, `routes/request-detail.tsx:268`
`:319` `:373`, `routes/admin.handover.$assetId.tsx:177`,
`lib/reminders.server.ts:66`.

---

## Verifica

1. `pnpm typecheck` — tipi e traduzioni mancanti nelle tre lingue.
2. `pnpm dev`, poi in Chrome → Applicazione: il manifesto senza errori, il
   service worker attivo, `Installa` nella barra degli indirizzi. Lighthouse
   sulla voce *Installable*.
3. **Prova della cache, la più importante**: aprire una scheda admin di un
   oggetto (che contiene `location` e `adminNotes`), uscire, riaprire l'URL a
   rete spenta. Deve comparire `offline.html`, **non** la pagina con i dati.
4. Push in locale: `/account` → attiva → «notifica di prova» → deve arrivare
   fuori dalla finestra del browser. Poi cancellare i dati del sito e mandarne
   un'altra: la riga in `PushSubscription` deve sparire (`pnpm db:studio`).
5. Il giro vero, due browser: un socio manda una richiesta, l'admin con canale
   `PUSH` riceve la notifica e **non** l'email; l'admin con `EMAIL` riceve solo
   la posta; un indirizzo in `ADMIN_EMAILS` che non è un utente riceve la
   posta. Toccando la notifica si apre `/requests/:id`.
6. Il ripiego: mettersi su `PUSH`, cancellare a mano le proprie iscrizioni,
   farsi mandare un avviso. Deve arrivare l'email.
7. **Su dispositivi veri**, dal tunnel `try.fabulabz.com` (già in
   `vite.config.ts`): un iPhone — aggiungi alla Home, permesso, notifica di
   prova, notifica a schermo bloccato — e un Android, dove va provato anche il
   pulsante «Installa». È il passo che si sottovaluta sempre e che trova più
   difetti di tutti gli altri messi insieme.

---

## Quanto costa

| | |
| --- | --- |
| Parte 1, guscio installabile | mezza giornata |
| Parte 2, motore push | una giornata |
| Parte 3, preferenza e destinatari | mezza giornata / una |
| Prove su iPhone e Android veri | mezza giornata |
| **Totale** | **circa due giornate e mezza–tre** di lavoro concentrato, dopo il rebrand |

Nessun servizio nuovo da pagare, nessun container in più: le notifiche push
passano dai servizi dei browser (Google, Apple, Mozilla) e sono gratuite. Lo
spazzatore orario dei promemoria che c'è già va bene anche per le notifiche —
un processo solo, come oggi.
