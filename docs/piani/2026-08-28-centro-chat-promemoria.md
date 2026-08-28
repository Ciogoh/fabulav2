# Fabula 0.7 — sei cose

> **Stato al 28 agosto 2026.** Fasi 1–5 fatte e provate dal vivo; la Fase 6
> (promemoria) è l'ultima e aspetta che `deliver()` esista — vedi
> [l'arretrato](2026-08-28-arretrato.md), voce A, scritta in parallelo da
> un'altra sessione.
>
> | Fase | | Commit |
> | --- | --- | --- |
> | 1 · la spunta e i sette giorni | ✅ | `Il modulo della richiesta chiede quello che serve sapere` |
> | 2 · i cinque minuti | ✅ | stesso commit della Fase 1 |
> | 3 · colori degli stati | ✅ | `Lo stato di un oggetto si vede da lontano` |
> | 4 · il Centro | ✅ | `Il Centro: quello che aspetta un admin sta in un posto solo` |
> | 5 · la chat dal vivo | ✅ | `La chat si aggiorna da sola, e il Centro con lei` |
> | 6 · i promemoria | ⏳ | — |

## Contesto

Fabula gira in produzione e il ciclo di prestito funziona da capo a fondo.
Quello che manca non è una funzione centrale: è **il contorno che la rende
usabile da volontari che si alternano** — accorgersi di una richiesta senza
avere tre posti da guardare, vedere una risposta senza ricaricare, capire a
colpo d'occhio se una cosa è libera, ricevere un promemoria **prima** e non
dopo, e non trovarsi davanti a un modulo che non chiede quello che serve
sapere.

Questo piano copre **sei voci**, decise insieme. Tutto il resto della lista —
notifiche push, PWA, calendario personale, guide e manuali, backup su R2,
tunnel, Telegram, documentazione, CI — sta in
[`2026-08-28-arretrato.md`](2026-08-28-arretrato.md), accanto a questo.

| # | Voce | Fase |
| --- | --- | --- |
| 1 | La spunta e i sette giorni, chiari | 1 |
| 2 | «Possono volerci fino a cinque minuti» | 2 |
| 3 | Colori degli stati più evidenti | 3 |
| 4 | Il Centro: coda, ritardi e messaggi in un posto solo | 4 |
| 5 | La chat che si aggiorna da sola | 5 |
| 6 | Promemoria automatici in prossimità della consegna | 6 |

**Due scelte già prese**, dalle domande di prima:

- **Il rosso resta «occupato»**, si rinforzano i contrasti (Fase 3).
- **Le notifiche push restano fuori da questo giro.** Conseguenza pratica per
  la Fase 6: i promemoria partono via **email**, e la Fase 6 va scritta in
  modo che il giorno in cui arriva `deliver()` (l'arretrato, voce A) cambi
  **una funzione sola** e non quattro.

### Le migrazioni, tutte insieme

Due, ognuna committata **insieme al codice che la usa** — la regola di
`docs/coolify.md`: uno schema spinto senza migrazione manda online codice che
parla a tabelle inesistenti. Si creano con la skill `prisma-migration`
(`prisma migrate dev` diretto fallisce in questo ambiente).

| Fase | Cosa |
| --- | --- |
| 4 | `Request.adminSeenAt`, `Request.userSeenAt` |
| 6 | `enum ReminderKind`, `model ReminderLog`, **rimozione** di `Request.reminderSentAt` **con travaso dei dati** |

Dopo ognuna, il controllo che `prisma migrate status` non fa:

```bash
prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Deve rispondere «This is an empty migration».

---

## Fase 1 — La spunta e i sette giorni, chiari

**Il difetto.** In `app/components/date-range-fields.tsx` il campo `purpose`
esiste **solo dentro a `{longer && (…)}`** (righe 153-168): chi non chiede più
di sette giorni non lo vede mai. Non c'è nessun posto in cui scrivere «mi
serve anche il carrello», «passo a ritirarlo di sabato», «mi servirebbe mezza
giornata in più». L'unico canale è la chat, che però nasce **dopo** l'invio,
quando l'admin ha già letto una richiesta nuda.

**Il cambiamento.** Il campo esce da quella guardia e **c'è sempre**, con due
identità che dipendono dalla spunta:

| Spunta `longer` | Etichetta | Obbligatorio | Aiuto sotto |
| --- | --- | --- | --- |
| spenta | «A cosa serve? Hai richieste particolari?» | no | «Non è obbligatorio, ma una richiesta con due righe di spiegazione si approva molto più in fretta. Scrivi qui anche eventuali esigenze: accessori, orari di ritiro, mezza giornata in più.» |
| accesa | la stessa, con «— obbligatorio» in coda | **sì** | «Spiega perché ti serve più di sette giorni.» |

Il tetto resta **esattamente com'è**: sette giorni ordinari
(`MAX_ORDINARY_SPAN_DAYS`), oltre solo con la spunta e fino a
`MAX_SPECIAL_SPAN_DAYS`. **Nessuna delle due costanti in
`lib/availability.shared.ts` si tocca.**

**L'ordine in pagina cambia**, e non è un dettaglio: oggi è *date → riga di
avviso → spunta → (campo)*, e il campo appare come conseguenza della spunta.
Diventa **date → riga di avviso → campo → spunta**, così il campo si legge come
parte normale della richiesta. Di conseguenza cambiano anche le stringhe che
dicono «spunta la casella **qui sotto**» (`request.maxSpan`,
`request.spanOver`): la casella adesso sta sotto al campo, non sotto
all'avviso.

**File toccati**

- `app/components/date-range-fields.tsx` — il campo esce dalla guardia,
  `required={longer}`, `maxLength={2000}`, `aria-describedby` verso il nuovo
  testo d'aiuto. La riga `aria-live` che avvisa del superamento resta dov'è:
  è già scritta bene, dice la regola prima e cosa hai fatto dopo.
- `app/routes/requests.tsx` (action, riga ~94) — resta
  `if (longer && purpose.length === 0)`; si aggiunge `purpose.slice(0, 2000)`
  prima della scrittura. Oggi quel testo entra **senza tetto** in una colonna
  `String`: è l'unico campo libero della piattaforma senza limite, la chat ha
  già `body.slice(0, 2000)`.
- `app/routes/request-detail.tsx` — stesso taglio nell'intento `editDates`
  (riga ~205), e il `useState("")` di **riga 460** va inizializzato con il
  `purpose` esistente. **Questo è un difetto vero che c'è già**: chi modifica
  le date di una richiesta che aveva una spiegazione se la vede cancellare
  senza nessun avviso. Si vede solo ora perché prima il campo era raro.
- `app/routes/admin.requests.tsx` — una riga in più su ogni scheda della coda
  con le prime ~120 lettere del `purpose`, in `--muted`. Un admin deve poter
  decidere «questa la guardo per prima» senza aprirla.
- `app/i18n/dictionaries.ts` — con la skill `add-i18n-key`, tre lingue:
  `request.purposeHint`, `request.purposeHintRequired`, `request.purposeOptional`;
  riscrittura di `request.maxSpan`, `request.spanOver`, `request.longer`,
  `request.purpose`.

**Verifica.** Catalogo → carrello → «Richiedi»: il campo si vede subito, si
manda vuoto e passa. Si spunta la casella: diventa obbligatorio e l'invio
vuoto dà `request.errorPurposeRequired`. Si apre la richiesta creata, si
modificano le date: **il testo scritto prima è ancora lì**. La coda admin
mostra il riassunto.

---

## Fase 2 — «Possono volerci fino a cinque minuti»

**Il difetto.** Dopo aver chiesto il codice si legge solo `signin.codeSentTo`:
«Codice mandato a … Vale dieci minuti.» Chi non lo vede arrivare in trenta
secondi preme «Mandane un altro» — e al terzo tentativo incontra il limite di
frequenza di Better Auth (tre codici al minuto, poi 429). Cioè **si blocca da
solo proprio mentre cerca di entrare**, e il messaggio che riceve
(`signin.tooManyRequests`) sembra dirgli che ha sbagliato qualcosa.

**Due aggiunte, e la seconda conta quanto la prima.**

1. **`signin.codeMayTakeMinutes`**, subito sotto a `codeSentTo`, in `--muted`:
   «Possono volerci fino a cinque minuti. Controlla anche la posta
   indesiderata.» Tre lingue.
2. **Il pulsante «Mandane un altro» resta spento 45 secondi**, con il conto
   alla rovescia scritto dentro (`signin.resendIn`, con `{seconds}`). Un
   `useState` più un `setInterval` dentro a `signin.tsx`, azzerato a ogni
   invio riuscito. È ciò che impedisce a chi aspetta di autobloccarsi.

La stessa riga va anche su `reset-password.tsx`, dove il problema è identico.

**File**: `app/routes/signin.tsx` (attorno alla riga 212),
`app/routes/reset-password.tsx`, `app/i18n/dictionaries.ts`.

**Verifica.** Si chiede un codice: la riga c'è, il pulsante è spento e il
numero scende. Si aspetta, si riprova, arriva un secondo codice. Non si
riesce più a incontrare il 429 premendo come un forsennato.

---

## Fase 3 — Colori degli stati più evidenti

**Come stanno oggi.** `components/state-badge.tsx` disegna una pastiglia con
testo colorato su fondo velato: `text-free bg-free-bg` (verde su verde
pallidissimo), `text-out bg-out-bg`, `text-idle bg-idle-bg`. Su una griglia di
catalogo, a mezzo metro, le tre pastiglie hanno **lo stesso peso visivo**: si
distinguono solo leggendole. La domanda «lo prendo adesso?» richiede di
fermarsi e leggere venti volte.

**La soluzione, in tre mosse che si sommano**, tenendo il rosso su «occupato»
come hai scelto.

### 1. Riempimento pieno dove la domanda è «lo prendo adesso?»

`StateBadge` guadagna una proprietà `tone`:

- **`tone="solid"`** — catalogo e scheda oggetto: fondo pieno del colore di
  stato, testo su un token nuovo. È il livello di evidenza di un semaforo.
- **`tone="soft"`** — elenchi fitti dell'admin (coda, ritardi, registro), dove
  dodici pastiglie piene di fila diventano una coperta. Resta lo schema di
  oggi.

Token nuovi in `app/app.css`, definiti **anche fuori dal blocco del tema
scuro** — la regola già pagata: un colore dichiarato solo lì sparisce nel tema
chiaro. Con i rapporti di contrasto annotati accanto, come si fa già per tutti
gli altri:

```
--free-solid / --on-free      verde pieno + testo chiaro
--out-solid  / --on-out       rosso pieno + testo chiaro
--idle-solid / --on-idle      grigio pieno + testo chiaro
```

### 2. Il colore non è mai solo colore — e adesso nemmeno solo parola

Ogni stato prende una **forma**: un carattere pieno prima del testo, marcato
`aria-hidden` perché il lettore di schermo legge già la parola.

| Stato | Forma | Perché quella |
| --- | --- | --- |
| Libero | `●` cerchio pieno | «c'è» |
| In uso / Non disponibile | `▪` quadrato pieno | «bloccato» |
| Non prestabile | `◇` rombo vuoto | assenza di stato, non un guasto |

Chi non distingue verde e rosso — circa un uomo su dodici — oggi vede tre
pastiglie identiche. Con la forma la risposta arriva anche in bianco e nero,
che è poi il caso di un elenco stampato.

### 3. La scheda porta lo stato, non solo la pastiglia

In `catalogue.tsx` l'`<article>` di riga 340 guadagna una **fascia di 3px sul
bordo superiore** del colore di stato. Scorrendo venti schede si vede quali
sono libere **senza leggere niente**. Per «non prestabile» la fascia è
tratteggiata e la scheda scende di opacità (il pulsante «Aggiungi» già non
c'è).

### Sul calendario

Le barre si differenziano per **riempimento** e non solo per tinta:
`REQUESTED` (in attesa) diventa **contorno con tratteggio diagonale** — «forse»
si legge dal disegno; `RESERVED` resta pieno arancione; `IN_USE` pieno rosso.
L'arancione sul calendario resta giusto, per la ragione già scritta in
`CLAUDE.md`: lì la barra è appoggiata sul giorno a cui si riferisce e non può
essere letta come «adesso».

> **Nota da lasciare in `CLAUDE.md`.** Al rebrand il rosso del marchio e il
> rosso «occupato» si scontreranno. La difesa è già in piedi e va solo
> rispettata: gli stati usano **token propri** (`--out`, `--free`, `--idle`) e
> **mai `--accent`**. Quando arriverà il rosso di Material Matters, `--out`
> potrà scendere verso un bordeaux profondo senza toccare una riga di
> componente. Chi cambia questi valori **ricalcola i rapporti**: tutte le
> coppie testo/fondo stanno sopra 4,5:1 in entrambi i temi, ed è una promessa
> scritta accanto ai valori.

**File**: `app/app.css`, `app/components/state-badge.tsx`,
`app/routes/catalogue.tsx`, `app/routes/item.tsx`, `app/routes/calendar.tsx`.

**Verifica.** Le due pagine nei due temi, poi con lo strumento di Chrome
(Rendering → Emulate vision deficiencies → **Protanopia** e **Achromatopsia**).
Gli stati devono restare distinguibili in tutti e quattro i casi.

---

## Fase 4 — Il Centro: coda, ritardi e messaggi in un posto solo

**Il difetto.** Un admin oggi ha **tre posti** da guardare e nessuno che li
riassuma: `/admin/requests`, `/admin/overdue`, e la chat — che non ha nessuna
superficie propria. Una risposta di un socio dentro a una richiesta **non
compare da nessuna parte** finché non si apre quella richiesta. Nell'
intestazione ci sono due pastiglie numeriche separate. Il lavoro di un turno
non ha un posto dove stare.

### Hai chiesto se accorpare è la scelta migliore. Ho guardato le alternative.

| Strada | Perché no |
| --- | --- |
| **Schede (tab) dentro a una pagina** | Una scheda **nasconde**. Il problema di oggi è che ci sono tre posti; tre schede sono tre posti con una passeggiata più corta. Per non nascondere servirebbe una pastiglia per scheda, cioè si torna a tre contatori. |
| **Un elenco unico in ordine di tempo**, tipo casella di posta, con le righe di tipo diverso mescolate | Sembra la soluzione elegante e non lo è: costringe a un confronto che **non ha una risposta giusta** — un ritardo di due giorni è più urgente di una richiesta ferma da cinque? — e toglie il vantaggio vero, che è lavorare a lotti («adesso approvo tutto, poi sollecito i ritardi»). |
| **Campanella con menu a tendina**, pagine separate sotto | Aggiunge una superficie invece di toglierne. E un menu a tendina non si può leggere con calma né filtrare. |
| **Una pagina, sezioni in ordine fisso** ✅ | Nessun clic per scoprire, ordine sempre uguale (la memoria muscolare vale più dell'ottimizzazione), lotti conservati, una pastiglia sola nell'intestazione. |

**Quindi sì, accorpare**, con due precisazioni che cambiano il risultato.

**La prima: l'ordine delle sezioni non è per gravità, è per «chi sta
aspettando te».** Il mio primo ordine metteva i ritardi in cima; è sbagliato,
perché su un ritardo il tempo è già passato e nessuno è fermo ad aspettare una
tua azione. L'ordine giusto:

1. **Da approvare** — c'è una persona ferma che aspetta, magari da giorni.
2. **Messaggi da leggere** — una persona ha scritto e aspetta risposta.
3. **Oggi e domani** — cosa si ritira e cosa si riconsegna. È la sezione che
   rende il Centro utile anche quando non c'è nient'altro: un admin che apre
   Fabula la mattina vede il lavoro della giornata.
4. **In ritardo** — importante, ma non urgente nello stesso modo.

**Con un'eccezione sola e dichiarata**: se c'è almeno un oggetto in ritardo da
**più di sette giorni**, la sezione «In ritardo» sale in cima con
l'intestazione in rosso. Una regola, visibile, spiegabile — non un
riordinamento intelligente che sposta le cose sotto le dita.

**La seconda: una striscia di pastiglie in cima**, quattro numeri colorati che
sono anche i collegamenti alle quattro sezioni. Così nessuna sezione può
sparire sotto la piega dello schermo, e da telefono si arriva dove serve con
un tocco. Le sezioni vuote **si richiudono in una riga grigia** («Niente da
approvare»), perché una giornata tranquilla deve stare in mezzo schermo e non
in quattro intestazioni vuote.

### Cosa si costruisce

**Rotta nuova `/admin`** (`app/routes/admin.tsx`), un loader solo per tutte e
quattro le sezioni. **Nessuna azione dentro al Centro**: ogni riga porta al
dettaglio. È la scelta già presa per la coda di approvazione e resta giusta —
approvare da un elenco significa approvare senza aver letto.

**Le due rotte vecchie non muoiono**: diventano viste filtrate.
`/admin/requests` → `redirect("/admin?vista=approvare")`, `/admin/overdue` →
`redirect("/admin?vista=ritardo")`. I segnalibri continuano a funzionare e le
query si spostano dentro al Centro invece di restare duplicate.

**L'intestazione**: al posto delle due pastiglie, una voce **«Centro»** con
**una pastiglia sola** — il totale di attesa + messaggi + ritardi — in `--out`
se c'è almeno un ritardo, altrimenti in `--accent`. Un `aria-label` scrive il
dettaglio per esteso («3 da approvare, 1 in ritardo»): un numero nudo non dice
di cosa.

**Schema** — due colonne, nessuna tabella nuova:

```prisma
model Request {
  // …
  /// L'ultima volta che un admin ha aperto questa richiesta. Serve solo a
  /// dire «c'è un messaggio nuovo»: si confronta con la data dell'ultimo
  /// messaggio, non si conta niente. Una tabella di lettura per messaggio,
  /// a questa scala, sarebbe sproporzionata.
  adminSeenAt DateTime?
  /// Lo stesso per chi ha fatto la richiesta.
  userSeenAt  DateTime?
}
```

Si scrivono nel `loader` di `request-detail.tsx` — chi apre la pagina l'ha
vista. Una scrittura in più per apertura, e in cambio «non letto» esiste.

**Lo stesso meccanismo dà la pastiglia anche ai soci**: `/requests` mostra
quali delle proprie richieste hanno risposte nuove. Oggi chi chiede in prestito
non ha **nessun** segnale che l'admin abbia scritto — ed è lo stesso difetto
visto dall'altra parte.

**Attenzione al costo**: il loader radice gira **a ogni pagina**. Oggi fa due
`count`; deve continuare a farne al massimo due (una per attesa e ritardi, una
per i messaggi non letti) e **solo per gli admin**, come già oggi — chi guarda
il catalogo da anonimo non paga niente.

**File**: nuovo `app/routes/admin.tsx`; modificati `app/routes.ts`,
`app/root.tsx`, `app/components/site-header.tsx`,
`app/routes/admin.requests.tsx` e `admin.overdue.tsx` (diventano redirect),
`app/routes/request-detail.tsx`, `app/routes/requests.tsx`,
`prisma/schema.prisma`, `app/i18n/dictionaries.ts`.

**Verifica.** Da admin con tutto vuoto: mezzo schermo e «niente da fare». Poi
si crea una richiesta da un altro browser: compare in cima, la pastiglia
nell'intestazione sale. Si scrive un messaggio da socio: compare in «Messaggi».
Si apre il dettaglio e si torna indietro: sparisce da lì. Si mette una fine a
dieci giorni fa: la sezione «In ritardo» sale in cima in rosso.

---

## Fase 5 — La chat che si aggiorna da sola

**Sì, è possibile, e senza nessun servizio nuovo.**

**La scelta: SSE (Server-Sent Events), con il polling come ripiego
automatico.**

| Strada | Perché sì / no |
| --- | --- |
| **SSE** ✅ | Una connessione HTTP tenuta aperta dal server. Passa da Cloudflare e da Traefik senza configurazione. È **unidirezionale**, che è esattamente ciò che serve: il browser scrive già con i form. Nessuna dipendenza nuova. |
| WebSocket | Bidirezionale, che qui non serve, e `react-router-serve` non lo espone: bisognerebbe sostituire il server con un Express scritto a mano. Costo alto, guadagno zero. |
| Polling | Semplice, ma un giro ogni tre secondi per ogni pagina aperta è traffico costante e la latenza si sente. **Resta come ripiego**, non come strada principale. |

### Il principio che rende la cosa sicura

> **Sul canale non passa mai il contenuto di un messaggio.** Il server manda
> soltanto un colpetto — «la richiesta X è cambiata» — e il browser chiama
> `revalidator.revalidate()`, cioè ricarica il loader esistente, con
> `loadAuthorized` e tutti i suoi `select` scritti a mano. Nessun campo può
> uscire da una strada nuova, perché **non c'è una strada nuova**: c'è una
> campanella.

### Cosa si scrive

**`app/lib/events.server.ts`** (nuovo) — un `EventEmitter` messo in cache su
`globalThis`, lo stesso schema già usato da `db.server.ts` per il client Prisma
e da `reminders.server.ts` per lo spazzatore (in sviluppo Vite ricarica i
moduli, e senza la cache nascerebbe un emettitore nuovo a ogni ricarica). Due
funzioni: `publishRequestChange(requestId)` e `publishAdminChange()`.

**`app/routes/api.stream.tsx`** (nuovo, rotta risorsa) —
`GET /api/stream?request=<id>`:

1. `requireUser` in prima riga.
2. **La stessa autorizzazione del dettaglio**: proprietario o admin, altrimenti
   404. Non si fida del fatto che un cuid sia difficile da indovinare.
3. `ReadableStream` con `Content-Type: text/event-stream`,
   `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`,
   `X-Accel-Buffering: no`.
4. **Un battito ogni 25 secondi** (`: ping\n\n`, una riga di commento del
   protocollo). Senza, un proxy che chiude le connessioni inattive a 30 o 60
   secondi taglia il canale e il ripiego entra in funzione senza motivo.
5. **Pulizia su `request.signal.addEventListener("abort", …)`**: si toglie
   l'ascoltatore dall'emettitore e si ferma il battito. **Se questo manca,
   ogni scheda chiusa lascia un ascoltatore attaccato e la memoria del
   processo sale per sempre.** È l'errore classico di questo schema.
6. **Tetto di connessioni**: massimo cinque flussi aperti per utente, il più
   vecchio si chiude. Difende dalla scheda lasciata aperta per giorni e da chi
   ne apre cento a mano.

**`app/lib/use-live.ts`** (nuovo) — l'aggancio lato browser:

- apre l'`EventSource` **solo quando la scheda è visibile**
  (`document.visibilityState` + `visibilitychange`), e la chiude quando passa
  in secondo piano: una scheda dimenticata non deve tenere una connessione;
- a ogni colpetto chiama `revalidator.revalidate()`;
- dopo **tre errori di fila smette e passa al polling** a 15 secondi. È il
  ripiego che rende la funzione affidabile anche dietro a una rete che ammazza
  le connessioni lunghe.

**Dove si pubblica**: in fondo agli intenti di `request-detail.tsx` che
cambiano qualcosa — `message`, `approve`, `reject`, `cancel`, `editDates`,
`pickup`, `return`, `note` — e `publishAdminChange()` da `requests.tsx`
(richiesta nuova) e da `admin.handover.$assetId.tsx`. Così **anche la
pastiglia del Centro e la sua prima sezione si aggiornano dal vivo**, senza
ricaricare: le due fasi si tengono per mano.

> **Il limite, da scrivere in `CLAUDE.md`** accanto a quello del limite di
> frequenza, perché è la stessa assunzione: l'emettitore vive **dentro al
> processo**. Con un processo solo — com'è oggi — funziona. Il giorno in cui i
> processi diventano due, un messaggio scritto sul processo A non sveglia una
> scheda collegata al processo B: la sostituzione è `LISTEN/NOTIFY` di
> Postgres, una ventina di righe, stessa forma di `events.server.ts`.

**Verifica.** Due browser diversi, stessa richiesta, uno da socio e uno da
admin: si scrive da una parte e il messaggio compare dall'altra **senza
toccare niente**, in meno di un secondo. Poi si stacca la rete per un minuto e
si riattacca — deve riprendersi da solo. Poi si guarda il pannello Rete per
trenta secondi con la scheda in secondo piano: **non deve esserci nessuna
richiesta**. Infine si aprono sei schede sulla stessa richiesta e si controlla
che la più vecchia venga chiusa.

---

## Fase 6 — I promemoria automatici, per davvero

**Com'è oggi.** `lib/reminders.server.ts` fa **un solo promemoria**: il giorno
prima della fine, con guardia su `Request.reminderSentAt`. Manca tutto il
resto — nessun avviso quando arriva il giorno del **ritiro**, nessuna
sollecitazione quando un oggetto è **in ritardo** — e un timestamp unico non
sa distinguere quale promemoria sia già partito.

**Un difetto che c'è già e va corretto qui.** Tutto ragiona in giorni UTC e lo
spazzatore gira ogni ora: il primo giro dopo la mezzanotte UTC parte **all'una
o alle due di notte** in Italia. Oggi è un'email e passa inosservata; il giorno
in cui arriveranno le notifiche push sarà una suoneria alle 2. Si aggiunge una
**finestra di invio**: si spedisce solo fra le **8 e le 20 ora di Roma**, e
fuori si salta — il giro dell'ora dopo riprova, perché il guardiano è sul
**giorno** e non sull'esecuzione.

### Schema — via il timestamp unico, dentro un registro

```prisma
enum ReminderKind {
  /// Domani puoi ritirare.
  PICKUP
  /// Domani scade.
  RETURN_SOON
  /// Scade oggi.
  RETURN_DUE
  /// È scaduto e non è tornato. Si ripete, a distanza crescente.
  OVERDUE
}

model ReminderLog {
  id        String       @id @default(cuid())
  requestId String
  request   Request      @relation(fields: [requestId], references: [id], onDelete: Cascade)
  kind      ReminderKind
  /// Il giorno UTC in cui è partito, `2026-08-28`. Sta qui e non si ricava da
  /// `sentAt` perché è metà della chiave: è ciò che rende lo spazzatore
  /// ripetibile senza mandare due volte lo stesso avviso, anche se il
  /// processo riparte tre volte nello stesso pomeriggio.
  dayKey    String
  sentAt    DateTime     @default(now())

  @@unique([requestId, kind, dayKey])
  @@index([requestId])
}
```

**La migrazione travasa i dati prima di togliere la colonna.** Senza questo,
chi ha già ricevuto il promemoria lo riceve di nuovo il giorno del rilascio:

```sql
INSERT INTO "ReminderLog" ("id", "requestId", "kind", "dayKey", "sentAt")
SELECT gen_random_uuid(), "id", 'RETURN_SOON',
       to_char("reminderSentAt", 'YYYY-MM-DD'), "reminderSentAt"
FROM "Request" WHERE "reminderSentAt" IS NOT NULL;

ALTER TABLE "Request" DROP COLUMN "reminderSentAt";
```

### Lo spazzatore riscritto: quattro passate, stessa forma

| Promemoria | Quando | A chi | Cosa dice |
| --- | --- | --- | --- |
| `PICKUP` | il giorno prima di `startDate`, richiesta `APPROVED`, **niente ancora ritirato** | a chi ha chiesto | «Da domani puoi ritirare X — presso *posizione*» |
| `RETURN_SOON` | il giorno prima di `endDate`, con roba ancora fuori | a chi ha chiesto | come oggi, più **dove riportarla** |
| `RETURN_DUE` | il giorno di `endDate` | a chi ha chiesto | «Scade oggi» |
| `OVERDUE` | **1, 3 e 7 giorni** dopo `endDate`, poi basta | a chi ha chiesto, **più un riassunto unico agli admin** | «È scaduto da N giorni» |

Due dettagli che decidono se la cosa è utile o fastidiosa:

- **Il riassunto agli admin è uno solo al giorno, con dentro tutti i ritardi.**
  Non uno per prestito: dieci email di fila sono dieci email che si
  cestinano insieme.
- **`OVERDUE` si ferma a sette giorni.** Un promemoria che continua per sempre
  smette di essere letto, e a quel punto la strada non è più automatica: è una
  telefonata. Il Centro (Fase 4) continua a mostrarlo.

**Il luogo dove ritirare e riportare** viene da `Asset.location`, che esiste già
e oggi è visibile solo nella scheda admin. Se una richiesta ha oggetti in posti
diversi, l'email li **raggruppa per posizione** invece di sceglierne una sola,
che mentirebbe. Se la posizione è vuota, la riga si omette.

### Predisposizione, non implementazione, per le notifiche future

Ogni invio passa da **una funzione sola** in `notifications.server.ts` —
`sendReminder(kind, destinatario, dati)` — che oggi chiama `sendEmail` e basta.
Il giorno in cui arriva il canale push (arretrato, voce A), **cambia il corpo
di quella funzione e nient'altro**. Se invece i quattro promemoria chiamassero
`sendEmail` per conto proprio, quel lavoro andrebbe rifatto quattro volte.

Un errore su una richiesta non ferma le altre — c'è già, resta, e adesso
`ReminderLog` fa sì che il tentativo fallito venga **ripetuto** invece di
perso.

**File**: `app/lib/reminders.server.ts` (riscritto),
`app/lib/notifications.server.ts` (tre messaggi nuovi più `sendReminder`),
`prisma/schema.prisma` e la migrazione con il travaso.

**Verifica.** Si creano a mano quattro richieste con date che cadono in
ciascun caso (`pnpm db:studio`), si forza un giro dello spazzatore, si
controlla che `ReminderLog` abbia **una riga per tipo** e che un secondo giro
**non ne aggiunga nessuna**. Poi si sposta l'ora del sistema fuori dalla
finestra 8-20 e si verifica che non parta niente e che il giro successivo
dentro la finestra recuperi. Infine si controlla che il riassunto agli admin
sia **uno**, con tre ritardi dentro, e non tre.

---

## Ordine e costo

| # | Fase | Costo | Perché in questo punto |
| --- | --- | --- | --- |
| 1 | **1** — spunta e sette giorni | mezza giornata | Si rilascia subito e si vede. |
| 2 | **2** — i cinque minuti | un'ora | Minuscola, e toglie un problema che chiude fuori la gente. |
| 3 | **3** — colori degli stati | mezza giornata | Indipendente. Prepara le pastiglie del Centro. |
| 4 | **4** — il Centro | una giornata | Prima della chat dal vivo, che poi lo fa aggiornare da solo. |
| 5 | **5** — chat dal vivo | mezza giornata | Aggiorna anche il Centro: le due si tengono. |
| 6 | **6** — promemoria | mezza giornata | Ultima: è quella che si prova più lentamente (bisogna far passare i giorni, o falsificarli). |

**Totale: circa tre giornate** di lavoro concentrato.

Alla fine, il rito già scritto in `CLAUDE.md`: **0.7.0** in `package.json`, la
sezione nel `CHANGELOG.md` che dice **il perché**, questo piano spostato in
`docs/piani/2026-08-28-centro-chat-promemoria.md` con la riga nell'indice, e
`git tag v0.7.0`.

---

## Verifica finale, quando le sei fasi sono dentro

Il giro completo, sul dominio vero e con due browser:

1. `pnpm typecheck && pnpm test && pnpm build` verdi.
2. Un socio chiede due oggetti per **otto giorni**: l'avviso appare, si spunta
   la casella, il campo diventa obbligatorio, manda. La spiegazione arriva
   nella coda admin **senza aprire la richiesta**.
3. L'admin apre `/admin`: la richiesta è nella prima sezione, la pastiglia
   nell'intestazione dice 1.
4. L'admin scrive in chat: **il socio la vede comparire senza ricaricare**, e
   la sua pagina `/requests` mostra il segnale di risposta nuova.
5. Il socio risponde: **compare nel Centro dell'admin**, in «Messaggi», senza
   che l'admin abbia toccato niente.
6. Nel catalogo, un oggetto libero e uno in uso si distinguono **da lontano**,
   e restano distinguibili con la simulazione del daltonismo accesa.
7. Si mette una fine a ieri e si forza lo spazzatore: arriva l'email di
   ritardo, e la sezione «In ritardo» compare nel Centro. Un secondo giro
   **non manda una seconda email**.
8. Si mette un inizio a domani: arriva il promemoria di ritiro con scritto
   dove passare.
9. `curl` da anonimo su `/admin` e su `/api/stream?request=<id>`: **404
   entrambi**, non 403.

---
