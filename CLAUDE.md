# Fabula — guida al progetto

Piattaforma di prestito degli oggetti dell'associazione **Material Matters**
(mamabz.com, Bolzano). Chiunque vede il catalogo e la disponibilità, chi ha un
account chiede in prestito, gli admin approvano.

Specifica completa e ragionata:
https://claude.ai/code/artifact/aec1d912-adc8-48d2-b327-87a8bdd4d1b3

**Parla italiano con l'utente.** Commenti e documentazione del codice in
italiano; identificatori e stringhe dell'interfaccia in inglese.

---

## Perché esiste (non riaprire questa decisione)

Prima c'era un fork di [Shelf](https://shelf.nu) in `../shelfnostro/`, abbandonato
perché ingestibile: piattaforma multi-tenant da azienda di cui si usava il 15%.

**Snipe-IT è stato valutato e scartato**: non ha prenotazioni con date — la
richiesta è aperta dal 2015 con quattro segnalazioni duplicate e non è mai stata
implementata. Partire da lì avrebbe significato riscrivere in PHP proprio la
parte difficile. Non riproporlo.

---

## A che punto siamo

**Il ciclo intero funziona da capo a fondo — dal catalogo alla riconsegna —
verificato dal vivo, non solo compilato:**

- Catalogo pubblico senza account, dove il badge risponde a «lo prendo
  adesso?» — Libero o In uso — e la prenotazione in arrivo sta nella riga
  piccola accanto (vedi *Un pulsante solo, un guscio solo*)
- Kit, che si sciolgono nei loro pezzi dentro al carrello
- Interfaccia in inglese, italiano e tedesco
- Accesso: codice via email (principale), password, Google e **Microsoft**
  (entrambi spenti finché mancano le chiavi nel `.env`)
- Email da Resend, dominio `fabulabz.com` verificato
- Calendario a righe-oggetto per colonne-giorno, con esportazione iCal pubblica
- Intestazioni di sicurezza e limite di frequenza sull'accesso, provati
- Profilo personale: foto, nome, cognome e alias, da `/account` (ci si arriva
  premendo il proprio nome in cima). **La foto si cambia premendo la foto** —
  bollino della fotocamera sempre visibile, anteprima immediata, controllo di
  misura e formato prima di spedire (`AvatarPicker`, in fondo a `account.tsx`)
- **Le date si scelgono al momento di richiedere, non in cima al catalogo**
  (`components/date-range-fields.tsx`). Fino a `MAX_ORDINARY_SPAN_DAYS` (sette
  giorni) senza altro; oltre, la spunta «richiesta speciale» chiede un motivo
  e sale fino a `MAX_SPECIAL_SPAN_DAYS`. I due tetti stanno in
  `availability.shared.ts` — vedi *Struttura*.
- **Invio della richiesta** (`routes/requests.tsx`, azione POST): il carrello
  manda a `/requests`, che ricontrolla disponibilità e prestabilità lato
  server — il carrello vive nel browser e può essere vecchio di settimane, un
  oggetto archiviato nel frattempo va rifiutato qui, non solo nascosto nel
  catalogo. Un'email avvisa gli admin (`notifyAdminsNewRequest`); se
  l'invio fallisce la richiesta resta comunque scritta.
- **Dettaglio di una richiesta** (`routes/request-detail.tsx`), due pubblici
  sullo stesso URL:
  - chi l'ha fatta: modifica le date (una richiesta già **approvata torna in
    `PENDING`** — l'approvazione manuale non ha scorciatoie), annulla (bloccato
    appena un pezzo è stato ritirato), scrive nella chat
  - admin: vede chi è davvero (nome ed email, non solo l'alias), approva o
    rifiuta, segna ritiro e riconsegna **per singolo oggetto** (regola 2),
    scrive una nota interna mai vista da chi ha chiesto, manda un promemoria a
    mano
  - la chat (`Message`) è aperta a entrambi: è lì che ci si accorda su un
    ritiro, non solo un canale per l'admin
- **Coda di approvazione** (`/admin/requests`): tutte le richieste in attesa,
  più vecchie prima, con un badge sul numero nell'intestazione admin (mostrato
  solo agli admin — un `db.request.count` in più a ogni pagina non lo paga chi
  guarda il catalogo da anonimo). Nessuna azione qui dentro: ogni riga porta al
  dettaglio.
- **Promemoria di riconsegna**: automatico, uno spazzatore orario in-process
  con guardia sul giorno già fatto (`lib/reminders.server.ts`, avviato dal
  loader radice), più il pulsante a mano nel dettaglio. Tutte le email di una
  richiesta — nuova, decisa, annullata, promemoria — vivono in un posto solo,
  `lib/notifications.server.ts`.
- **Pannello admin: oggetti, categorie e kit** (`/admin/assets`, tre schede),
  con ricerca, filtro, gruppi per categoria e spostamento in blocco. Una
  categoria si crea anche dal menu a tendina della scheda di un oggetto, senza
  uscire. Un oggetto si elimina se non è mai stato prestato e si archivia se
  lo è stato (regola 1).
- **Soci** (`/admin/members`): promuovere o rimuovere un admin (non su se
  stessi, mai l'ultimo admin rimasto) e mandare un link di reset password
  (`/reset-password`) — è anche il modo in cui chi è entrato solo col codice
  via email si aggiunge una password.
- Caricamento delle foto, con anteprima prima di spedire, tipo vero validato
  sui byte (non sull'estensione) e ridimensionamento in JPEG — oggetti e
  avatar.
- Ottimizzazione per telefono: il calendario sotto ai 640px è un elenco
  oggetto per oggetto invece di una timeline, sopra la colonna dei nomi è
  `sticky`, e il `<nav>` va a capo invece di far scorrere la pagina intera in
  orizzontale.

- **Registro delle azioni admin** (`/admin/log`, `lib/audit.server.ts`): chi
  ha fatto cosa fra le azioni che toccano la fiducia o lo stato di un
  prestito. Sola lettura, senza nemmeno un modo di cancellare una riga — un
  registro che si può modificare non è un registro.
- **Storico dei prestiti** nella scheda admin di un oggetto: chi l'ha avuto e
  quando, sotto ai campi e sopra al pulsante di archiviazione, che è il
  momento in cui la domanda «vale lo spazio che occupa?» si fa davvero.
- **QR, scanner e consegna diretta** — vedi il capitolo *Il QR e la consegna
  diretta*.

**Manca**, in ordine di priorità:

1. **Allineamento visivo a Material Matters** (vedi *Aspetto*) — resta il
   pezzo grosso, ma è quasi solo una sostituzione di valori: i token sono già
   tutti in `app.css`.
2. **PWA installabile**, con le notifiche al posto delle sole email. Deciso
   come passo successivo, non ancora cominciato — il piano è già scritto per
   intero in [`docs/piani/2026-08-24-pwa-notifiche.md`](./docs/piani/2026-08-24-pwa-notifiche.md).

La storia di come ci siamo arrivati sta in [`CHANGELOG.md`](./CHANGELOG.md), i
ragionamenti dietro a ogni passo in [`docs/piani/`](./docs/piani/).

---

## Comandi

```bash
pnpm install
cp .env.example .env      # poi riempi i valori
pnpm db:up                # PostgreSQL nel container
pnpm db:migrate           # crea/applica le migrazioni
pnpm db:seed              # dati di esempio
pnpm dev                  # http://localhost:5173
pnpm typecheck            # tipi + traduzioni mancanti
```

`pnpm db:studio` per sfogliare il database, `pnpm db:reset` per ripartire da
zero (distruttivo).

---

## Versione, changelog e piani

Tre pezzi della stessa storia: **il piano dice cosa vogliamo fare, il
`CHANGELOG.md` dice cosa è uscito, la versione dice quando.**

### La riga

```
Fabula 0.5.1 · build 35 · 2026-08-24
```

Si vede in fondo a `/admin/log` e nella schermata di errore — dove sapere quale
copia si è rotta è la prima domanda di chi riceve una segnalazione. Il piè di
pagina vero non esiste ancora: quando arriverà col rebrand, spostarla è una
riga, perché `versionLabel()` (`lib/version.ts`) è un posto solo.

I tre valori fanno **mestieri diversi**, ed è per questo che sono tre:

| | da dove | chi lo alza |
| --- | --- | --- |
| `0.5.1` | `package.json` | a mano, quando finisce un pezzo di lavoro |
| `build 27` | `git rev-list --count HEAD` | da solo, a ogni commit |
| `2026-08-24` | la data di costruzione | da sola |

`build` risponde a «**cosa sta girando davvero?**» ed è un'impronta digitale:
sale anche per un refuso, e non misura niente. La versione risponde a «**quanto
è cresciuta?**» ed è un giudizio. Chi prova a farne fare uno solo a entrambi
ottiene un contatore che non racconta niente.

I valori arrivano dal `define` di `vite.config.ts`, ognuno con il suo ripiego a
`"?"`: **la costruzione non deve mai fallire per colpa del numero di versione**.
Per questo `.dockerignore` **non** esclude più `.git` e il `Dockerfile`
installa `git` nello stadio di costruzione — vedi i commenti in quei due file,
compreso il perché non è in contraddizione con l'esclusione del `.env`.

### Cosa significano i numeri qui

Il semver da libreria non si applica: Fabula ha un'installazione sola e nessuno
che dipenda da lei. MAJOR non vuol dire «rottura di compatibilità».

- **MINOR** (0.5 → 0.6): una capacità nuova che si vede usando — la PWA, il
  registro admin, il QR.
- **PATCH** (0.5.0 → 0.5.1): correzioni e rifiniture.
- **MAJOR**: **la 1.0.0 è la consegna ai soci.** Dopo, solo ciò che obbliga
  qualcuno a cambiare abitudine.

**Alla 1.0 si riapre la domanda, e solo lì.** Per le applicazioni si consiglia
spesso il versionamento a calendario (`2026.08`) invece del semver: nessun
giudizio da dare, nessun numero da dimenticare. Qui non è stato scelto perché
un calendario avanza anche nei mesi in cui non succede niente, e finché la
consegna è davanti la domanda vera è «quanto manca» — a cui `0.5.0` risponde e
`2026.08` no. Quando il traguardo sarà passato quel vantaggio sparisce, e
tanto vale riguardarla. **Cambiare costa una riga**: niente nel codice dipende
dalla forma di quella stringa, `versionLabel()` continua a funzionare identico.
Fino ad allora, non riaprire la discussione.

### Il rito, quando un piano è finito

1. si alza il MINOR in `package.json`;
2. si scrive la sezione nel `CHANGELOG.md` — il **perché**, non solo il cosa;
3. si segna ✅ il piano in `docs/piani/README.md`;
4. `git tag v0.6.0`, da cui `git describe` dà gratis «v0.6.0-3-gae38553».

### I piani

Stanno in [`docs/piani/`](./docs/piani/), dentro al repo: versionati, nel
backup, leggibili da chiunque apra il progetto.

**Claude Code però li scrive in `~/.claude/plans/`**, fuori di qui e con un
nome generato a caso (`rosy-seeking-kazoo.md`). Alla fine di una sessione di
pianificazione il file va spostato in `docs/piani/` e rinominato
`AAAA-MM-GG-argomento.md`, con la riga nell'indice. È un gesto manuale: non
c'è un modo di far scrivere Claude Code direttamente lì.

---

## Le regole che non vanno rotte

### 1. Gli stati non si salvano mai

Libero, Prenotato e In uso si **calcolano** dalle prenotazioni attive
(`app/lib/availability.server.ts`). Aggiungere un campo `stato` sull'oggetto
crea un dato che prima o poi mentirà. Vale anche per lo stato della richiesta.

**`Asset.archivedAt` non è un'eccezione a questa regola**, ed è utile capire
perché. Non è uno stato di disponibilità: non si ricava da nessun'altra riga
del database, è una decisione di chi amministra — «questa cosa non è più
nostra», venduta, persa, rotta per sempre. Un campo qui non può mentire,
perché non c'è nessuna verità altrove con cui possa andare fuori sincrono.

Non va confuso con `isBookable`, che è temporaneo e lascia l'oggetto in
vetrina: «in riparazione» si vede nel catalogo, «archiviato» no.

Il filtro degli archiviati sta in **un posto solo per i tre calcoli**
(`NOT_ARCHIVED` in `availability.server.ts`), e non è pignoleria: una di
quelle query alimenta il feed iCal, che è pubblico per costruzione. Se il
filtro vivesse nelle rotte, prima o poi una lo dimenticherebbe e il nome di un
oggetto tolto dal catalogo continuerebbe a uscire da lì.

**Archiviare toglie l'oggetto anche da tutti i kit.** Un kit che continuasse a
contenerlo mostrerebbe un pezzo che nel selettore non esiste più, e al primo
salvataggio lo perderebbe in silenzio. Rimettere in catalogo non lo rimette
nei kit: quello si fa a mano, e la scheda lo dice.

### 2. Il ritiro sta sugli oggetti, non sulla richiesta

`RequestStatus` ha **solo** gli stati decisionali (`PENDING`, `APPROVED`,
`REJECTED`, `CANCELLED`). Il passaggio di mano vive su `RequestItem` come
`pickedUpAt` / `returnedAt`. Così **una riconsegna parziale libera subito i
pezzi tornati** invece di tenerli bloccati fino all'ultimo.

### 3. I kit non entrano nella disponibilità

`Kit` e `KitAsset` servono solo al catalogo per riempire il carrello in un
colpo. Il controllo di sovrapposizione guarda **solo** `RequestItem`. Se ti
ritrovi a interrogare `Kit` per sapere se qualcosa è libero, hai sbagliato
strada.

### 4. Niente quantità

Dieci sedie identiche sono dieci oggetti. Escluse di proposito: con le quantità
la disponibilità smette di essere sì/no e non esiste modo semplice di dire
«dal 5 al 7 ne hai 3, ma il 6 solo 1». Rimandarle non costa niente — due
colonne banali più la riscrittura del motore, che costa uguale oggi o fra due
anni.

### 5. Le traduzioni sono tipizzate

`app/i18n/dictionaries.ts`, chiavi piatte. L'inglese è la lingua di
riferimento: se manca una chiave in italiano o tedesco, `pnpm typecheck`
fallisce. Niente librerie. **I nomi degli oggetti non si traducono.**

### 6. Come si chiama una persona lo decide un posto solo

Si vede **sempre l'alias**; nome e cognome stanno nel suggerimento del
passaggio del mouse. Le funzioni sono in `lib/person.ts` e i componenti in
`components/person.tsx` — `<PersonName>` e `<Avatar>`. Non scrivere
`user.name` in una schermata: quel campo esiste solo perché lo pretende
Better Auth, e mostra il nome di Better Auth, non quello che la persona ha
scelto.

- `displayNameOf` → quello che si legge a schermo (alias, o nome e cognome).
- `fullNameOf` → «Mario Rossi».
- `fullLabelOf` → «Vale (Mario Rossi)». **Questo va nelle email e nelle
  superfici admin**: chi consegna un oggetto di persona deve sapere chi è
  davvero, non solo come si fa chiamare.
- `name` resta allineato a «nome cognome» a ogni salvataggio del profilo.

Il suggerimento del mouse non esiste sul telefono e non esiste da tastiera:
per questo `<PersonName>` ripete il nome per esteso anche in un pezzo di
testo per soli lettori di schermo. Se ne scrivi uno a mano, fai lo stesso.

**La foto del profilo può venire da fuori.** Chi entra con Google ha in
`image` un indirizzo `lh3.googleusercontent.com`, non un percorso nostro:
`isUploadedAvatar` è la guardia da usare prima di toccare il disco, e
`<Avatar>` mette `referrerPolicy="no-referrer"` per non dire a Google da
quale pagina di Fabula la si sta guardando.

### 7. Un pulsante solo, un guscio solo

Erano quattro fatture di pulsante scritte a mano e sei larghezze di pagina, e
ogni schermata nuova ne inventava una in più: passando da una pagina all'altra
il bordo sinistro del contenuto saltava, e il difetto di contrasto del
pulsante primario andava corretto in dodici punti.

- I pulsanti si prendono da `components/button.tsx` (`Button`, `ButtonLink`,
  o `buttonClass()` quando serve la sola classe su un elemento esistente).
  Cinque varianti, due misure: se ne serve una sesta, si aggiunge lì.
- Le pagine si avvolgono in `components/page.tsx`. `wide` per griglie e
  calendario, `narrow` per elenchi e dettagli — che è un **tetto di misura
  dentro** alla colonna larga, non un secondo contenitore centrato, così il
  bordo sinistro cade sempre sotto la «F» di Fabula. `form` è l'eccezione
  dichiarata per accesso, benvenuto e reimposta password.
- Ogni rotta ha il suo `meta`, costruito con `pageTitle()` di `i18n/meta.ts`.
  Restituivano tutte `{ title: "Fabula" }`: schede, cronologia, segnalibri e
  lettori di schermo non distinguevano una pagina dall'altra.
- I menu a tendina si prendono da `components/select.tsx`. Un `<select>` nudo
  si porta dietro la freccia del sistema operativo, che accanto a un campo
  disegnato da noi si vede che viene da un altro mondo: `Select` la sostituisce
  con la nostra e lascia nativo l'elenco che si apre, l'unica versione che
  funziona col dito, da tastiera e con un lettore di schermo.
- Avatar e nome insieme si prendono da `PersonInline`
  (`components/person.tsx`), e **la misura del testo si dichiara sulla riga,
  non sui pezzi**. Lo stesso sfasamento è tornato tre volte — registro, chat,
  coda di approvazione — sempre per due motivi che si sommavano. Il primo: un
  `<span className="flex items-center gap-2">` intorno ad avatar e nome. Un
  contenitore flex prende come propria linea di base quella del suo primo
  elemento, e la linea di base di un'immagine è il suo bordo inferiore: dentro
  a una riga con `items-baseline` il nome finiva sette pixel più in alto di
  tutto il resto. Il secondo: `text-sm` scritto sui fratelli ma non sul nome,
  che ereditava i 16px del documento e restava il più grande della riga.
  `PersonInline` non è un flex e non dichiara nessuna misura, quindi va bene
  in una frase come dentro a un `items-baseline`.

  Quando invece l'avatar sta in una colonna sua — il registro — l'allineamento
  si scrive con le misure e non a occhio: `text-sm/7` è una linea di 28px, cioè
  esattamente `h-7`, l'altezza dell'avatar `sm`. Con `items-start` i pezzi
  cadono al posto giusto da soli, e non resta nessun `pt-1.5` da ritoccare la
  prossima volta che cambia una misura.

- Lo stato di un oggetto passa sempre da `StateBadge`. Il colore non è mai
  l'unico portatore: parola e, quando c'è, data.

  Il badge riceve lo stato **di dominio** (tre più «non prestabile») e ne
  mostra uno **visivo**, perché il colore deve rispondere a una domanda sola:
  *lo prendo adesso?* `RESERVED` ne porta due opposte — con `from` la
  prenotazione deve ancora cominciare e oggi l'oggetto è libero, senza è già
  cominciata e l'oggetto non c'è. Erano lo stesso arancione, e su un oggetto
  prenotato per la settimana dopo la gente passava oltre credendolo occupato.
  Oggi il primo caso è verde con la data della prenotazione in `--muted`
  accanto (solo entro `UPCOMING_NOTE_DAYS`), il secondo è rosso come il
  ritirato. L'arancione resta sul calendario, dove la barra è appoggiata sul
  giorno a cui si riferisce e non può essere letta come «adesso».

---

## Sicurezza

Questo è il capitolo su cui l'utente ha insistito. Le regole valgono per ogni
riga nuova.

### Le regole

**Ogni action che scrive comincia con `requireUser` o `requireAdmin`**
(`app/lib/session.server.ts`). Nascondere un pulsante nell'interfaccia non
protegge niente: l'indirizzo resta raggiungibile da chiunque con `curl`.
`requireAdmin` risponde **404 e non 403**, così a chi non è admin il pannello
non risulta nemmeno esistere.

**Niente dati riservati nei loader pubblici.** `Asset.location` e
`Asset.adminNotes` non devono mai finire in una risposta senza login. I `select`
di Prisma vanno scritti a mano campo per campo: mai `include: true`, che un
giorno porterà fuori una colonna aggiunta dopo.

**Nessun nome di persona nelle superfici pubbliche.** Il catalogo dice che un
oggetto è occupato, non chi ce l'ha. `getOccupancy` ha `withHolders`, spento di
serie: accendilo solo dopo `requireAdmin`. Per la stessa ragione lo storico
dei prestiti di un oggetto sta nella sua scheda **admin** e non in quella
pubblica: dice chi ha avuto cosa, ed è esattamente ciò che il catalogo tace.

**Le foto caricate stanno su un indirizzo pubblico**, avatar comprese:
`/uploads/*` non chiede chi sei, come per le foto del catalogo. Il nome del
file è un UUID casuale generato al caricamento e mai derivato da quello
mandato dal browser, quindi non si indovina — ma chi ha l'indirizzo lo apre.
Se un giorno servisse una foto davvero riservata, quella rotta va protetta,
non basta un nome difficile.

**Il feed iCal è pubblico per costruzione.** Un indirizzo `.ics` non può chiedere
chi sei — i programmi di calendario lo scaricano e basta — quindi tutto ciò che
contiene è pubblico. Solo nome dell'oggetto e date. Le richieste in attesa
restano fuori.

**Ogni `redirect` verso un percorso che arriva dall'utente va filtrato**
(`next`, `redirectTo`). Deve cominciare per `/` e **non** per `//`, altrimenti è
un redirect aperto verso un altro sito. Vedi `signin.tsx`, `welcome.tsx`,
`language.tsx`.

**Nome e cognome non passano da `mapProfileToUser`.** Da un conto esterno il
nome arriva in una stringa sola e i campi del profilo sono due, ma scriverli
dall'accesso vorrebbe dire dichiararli a Better Auth come campi utente — e un
campo dichiarato senza `input: false` si può impostare dal corpo della
richiesta di registrazione, mentre uno *con* `input: false` fa fallire la
creazione se qualcuno prova a valorizzarlo. Il taglio si fa invece in
`/welcome`, dove c'è già la validazione delle lunghezze e dove la persona
conferma: `newUserCallbackURL` ci manda chi si registra adesso, e solo lui.

**I campi di ruolo hanno `input: false`** nella configurazione di Better Auth.
Senza, il corpo della richiesta di registrazione può contenere `role: "ADMIN"` e
chiunque si nomina amministratore da solo.

**Quello che arriva dalla fotocamera è dato, non un indirizzo.** Un adesivo QR
è un oggetto fisico: chiunque entri in magazzino può sostituirlo con uno
stampato in casa. Il testo decodificato non si passa mai a `navigate()` così
com'è — si valida che sia della nostra origine e col percorso atteso, e si
**ricostruisce** il percorso dall'identificativo catturato
(`handoverPathFrom`, in `admin.scan.tsx`). È la stessa regola del redirect
filtrato, applicata a una superficie nuova.

**Mai `dangerouslySetInnerHTML`, mai `$queryRawUnsafe`.** Al momento non ce n'è
nessuno: tienilo così. Se serve SQL grezzo, usa `Prisma.sql` con i parametri.

**I segreti stanno solo nel `.env`**, che è in `.gitignore`. Prima di un
commit, controlla cosa stai includendo.

### Cosa è già stato messo e provato

| Difesa | Dove | Verificato |
| --- | --- | --- |
| Limite di frequenza sull'accesso | `auth.server.ts` | 3 codici al minuto, poi 429 |
| IP reale dietro Cloudflare | `advanced.ipAddress` | vedi sotto |
| `SESSION_SECRET` obbligatoria in produzione | `auth.server.ts` | l'avvio fallisce se manca |
| `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`, `Permissions-Policy` | `root.tsx` `headers()` | presenti nella risposta — su `Permissions-Policy` vedi la trappola della fotocamera |
| HSTS un anno | `root.tsx`, solo produzione | — |
| Password minimo 10 caratteri | `auth.server.ts` | — |
| Collegamento account solo a parità di indirizzo | `account.accountLinking` | `allowDifferentEmails` spento |
| Postgres esposto solo su `127.0.0.1` | `docker-compose.yml` | — |

**`advanced.ipAddress.ipAddressHeaders` non va tolto.** Dietro al tunnel
Cloudflare tutte le richieste arrivano dallo stesso indirizzo: senza quella
riga, Better Auth mette tutti in un unico secchio condiviso, il limite diventa
tre codici al minuto *per l'intera associazione*, e chiunque può bloccare
l'accesso a tutti consumandoli. Better Auth stesso lo segnala nei log.

### Cosa resta aperto

- **Nessuna `Content-Security-Policy` completa.** React Router mette in pagina
  uno script in linea con i dati dei loader, quindi una politica seria richiede
  i «nonce» generati a ogni risposta. C'è solo `frame-ancestors`, che è la parte
  utile contro il clickjacking e non rompe nulla.
- **Il limite di frequenza sta in memoria**, quindi si azzera a ogni riavvio e
  non si condivide fra processi. Con un processo solo va bene; se un giorno se
  ne mettono due, va spostato su database.
- **Il registro degli admin non copre le modifiche di campo.** Rinominare un
  oggetto, cambiarne la descrizione o la categoria non lascia traccia: è una
  scelta, non una dimenticanza (sono azioni reversibili e a basso rischio, e
  registrarle riempirebbe il registro di rumore). Se un giorno servisse,
  `logAdminAction` è già generico abbastanza.
- **Un `AdminAction` non ha una chiave esterna verso il suo bersaglio**, e non
  è un difetto da correggere: un vincolo cancellerebbe in cascata proprio la
  riga che dice «questo oggetto è stato eliminato». `targetId` che punta al
  vuoto è normale, e `detail` è il testo che sopravvive.
- **`AdminAction.actor` invece è `onDelete: Cascade`, e va cambiato il giorno
  in cui si potrà cancellare un account.** Oggi non si può — `/admin/members`
  fa solo ruolo e reset, e il plugin `deleteUser` di Better Auth è spento —
  quindi il caso non esiste. Ma cancellare una persona cancellerebbe tutte le
  sue righe di registro, cioè proprio la traccia di chi ha più motivo di
  volerla sparire. Correzione minima quando servirà: `actorId` opzionale con
  `SetNull`, e il nome dell'attore scritto dentro `detail` come si fa già per
  il bersaglio.

---

## Aspetto

**Va allineato al sito dell'associazione, e oggi non lo è.** L'attuale palette
blu-inchiostro è stata scelta prima di conoscere mamabz.com.

La direzione giusta: **monocromatica** (bianco, nero, grigi) con **accento
rosso** (il cuore del logo), carattere **Mattone** di Nunzio Mazzaferro e
Collletttivo. Layout minimale, contenuto prima della decorazione.

Mattone **non sta su Google Fonts**: va scaricato e servito da `public/fonts/`.
Non inventare un accento diverso dal rosso.

### I token, e le due regole che li tengono in piedi

I colori sono tutti in `app/app.css`, quindi il cambio è quasi solo una
sostituzione di valori. **Ogni colore va definito anche fuori dal blocco del
tema scuro**, o sparisce nel tema chiaro.

**1. Ogni token semantico dice una cosa sola.** `--out` significa
«indisponibile o guasto». Quando è servito un fondo per la modalità admin è
stato preso in prestito `--out-bg`, e per mesi l'intestazione ha detto
«errore» a chiunque avesse i permessi — rosa pallido nel tema chiaro. Se serve
un colore nuovo si aggiunge un token nuovo: da qui `--admin-bg` /
`--admin-rule` per la barra dell'admin e `--idle` / `--idle-bg` per «non
prestabile», che non è un guasto. Questa regola è anche ciò che rende
possibile il passaggio al rosso: finché il rosso significa «rotto», non può
diventare l'accento del marchio.

**2. Sopra un fondo pieno di accento ci va `--on-accent`, mai `white`.** Nel
tema scuro l'accento è chiaro: bianco su `#86a4ee` fa 2,45:1 e non si legge.
Il difetto era in dodici pulsanti primari su otto file, cioè in ogni schermata
con un'azione principale. Oggi `--on-accent` vale bianco nel tema chiaro e
inchiostro in quello scuro, 7,58:1 in tutti e due.

Stessa trappola con le velature: `bg-ink/50` su un modale *schiarisce* la
pagina nel tema scuro, perché `--ink` lì è chiaro. Un velo si scrive
`bg-black/60`.

Tutte le coppie testo/fondo dei token stanno sopra 4,5:1 in entrambi i temi, e
i rapporti sono annotati accanto ai valori in `app.css`. Se ne cambi uno,
ricalcola: `--muted` porta tutte le etichette piccole, `--faint` è solo
decorazione (monogrammi segnaposto) e non va usato per testo che informa.

**Il telefono conta.** L'associazione consegna oggetti di persona, quindi la
piattaforma verrà usata in magazzino col telefono in mano. Le altezze minime
dei pulsanti (44px, 36px nelle tabelle admin) nascono da lì, non da un
capriccio: vedi `components/button.tsx`.

---

## Struttura

```
app/
  routes/ — pubblico
    catalogue.tsx       il catalogo pubblico, con ricerca
    item.tsx            la scheda di un oggetto (pubblica)
    availability.tsx    sole risorse: «liberi in queste date?»
    calendar.tsx        la timeline oggetti × giorni, elenco sul telefono
    calendar[.]ics.tsx  il feed iCal pubblico
    uploads.tsx         serve le foto caricate, pubblico apposta (vedi Sicurezza)
    h.$code.tsx         l'indirizzo corto stampato sugli adesivi: rimanda alla consegna

  routes/ — accesso e profilo
    signin.tsx          accesso: codice, password, Google, Microsoft
    welcome.tsx         il nome, chiesto una volta al primo accesso
    reset-password.tsx  imposta una password da un link — anche il primo utilizzo
    account.tsx         il proprio profilo: foto, nome, alias, lingua
    api.auth.$.tsx      gestore unico di Better Auth
    language.tsx        cambio lingua (scrive il cookie)

  routes/ — richieste (chi prende in prestito)
    requests.tsx        «le mie richieste»: elenco (GET) + crea dal carrello (POST)
    request-detail.tsx  il dettaglio: date, annulla, chat — e, per l'admin, approva/rifiuta,
      ritiro/riconsegna per oggetto, nota, promemoria

  routes/ — solo admin
    admin.requests.tsx         la coda di approvazione
    admin.members.tsx          i soci: ruolo e link di reset password
    admin.assets.tsx           gli oggetti: ricerca, filtro, gruppi per categoria
    admin.assets.$id.tsx       scheda di un oggetto: modifica, foto, QR, storico, archivia/elimina
    admin.assets.new.tsx       nuovo oggetto
    admin.categories.tsx       le categorie: crea, rinomina, riordina, elimina
    admin.kits.tsx             i kit, con i pezzi in chiaro su ogni riga
    admin.kits.$id.tsx         scheda di un kit
    admin.kits.new.tsx         nuovo kit
    admin.scan.tsx             lo scanner: la fotocamera che legge gli adesivi
    admin.handover.$assetId.tsx  la consegna diretta — l'indirizzo dentro al QR
    admin.log.tsx              il registro: chi ha fatto cosa

  components/
    button.tsx             l'unico pulsante
    page.tsx               l'unico guscio di pagina
    select.tsx             l'unico menu a tendina
    state-badge.tsx        i quattro stati, mai solo colore
    admin-badge.tsx        l'etichetta ADMIN, ovunque serva
    person.tsx             <PersonName> e <Avatar>
    site-header.tsx        intestazione, menu profilo, cambio lingua
    cart-bar.tsx           il carrello e il foglio della richiesta
    date-range-fields.tsx  le date, condivise fra foglio e dettaglio
    photo-picker.tsx       le foto: quelle che ci sono e quelle in arrivo
    asset-fields.tsx       il modulo di un oggetto (nome, categoria, foto, note)
    kit-fields.tsx         il modulo di un kit e il selettore dei pezzi
    person-picker.tsx      scegliere una persona: il fratello a scelta singola di AssetPicker
    admin-tabs.tsx         oggetti · kit · categorie, le tre schede admin

  lib/
    availability.server.ts   il motore di disponibilità
    availability.shared.ts   i tetti di durata, anche per il browser
    db.server.ts             il client Prisma, uno solo per tutta l'applicazione
    session.server.ts        getUser / requireUser / requireAdmin
    auth.server.ts           configurazione dell'accesso (Better Auth)
    auth-client.ts           il client di Better Auth, lato browser
    audit.server.ts          logAdminAction: il registro, una funzione sola
    qr.server.ts             il QR di un oggetto, e l'indirizzo che ci sta dentro
    notifications.server.ts  tutte le email di una richiesta, in un posto solo
    reminders.server.ts      lo spazzatore orario del promemoria automatico
    email.server.ts          Resend, con ripiego a terminale
    ical.server.ts           generazione iCalendar
    uploads.server.ts        foto degli oggetti (due file) e avatar (uno)
    person.ts                alias, nome per esteso, etichetta per gli admin
    request-status.ts        le etichette dei quattro stati, in un posto solo
    categories.ts            slug e nome ripulito, anche per il browser
    categories.server.ts     la categoria creata dalla scheda di un oggetto
    kits.server.ts           gli oggetti da spuntare, e la riscrittura dei pezzi
    initials.ts              le iniziali per i segnaposto
    use-cart.ts              il carrello, prima dell'invio
    version.ts               versionLabel(): versione, build e data in un posto solo

  i18n/    tre lingue, tipizzate + i titoli delle pagine
  app.css  i token, con i rapporti di contrasto annotati

prisma/schema.prisma    dieci tabelle nostre + tre di Better Auth (Session, Account, Verification)
```

`availability.shared.ts` esiste per una ragione sola: `availability.server.ts`
importa il database, quindi un componente che ne prendesse `MAX_ORDINARY_SPAN_DAYS`
si porterebbe Prisma dentro al pacchetto del browser. I due tetti di durata
servono da entrambe le parti e devono restare **lo stesso numero**.

### Il QR e la consegna diretta

Si stampa un adesivo per oggetto, lo si inquadra col telefono, si sceglie a
chi darlo e fino a quando. Quattro file: `lib/qr.server.ts` genera il codice,
`routes/admin.scan.tsx` lo legge, `routes/h.$code.tsx` traduce l'indirizzo
corto dell'adesivo, `routes/admin.handover.$assetId.tsx` consegna.

**Lo stesso adesivo ha due destinazioni, decise da chi lo inquadra.**
`routes/h.$code.tsx` chiama `getUser` e smista: un **admin** finisce sulla
consegna diretta, chiunque altro — anonimo o socio — finisce sulla scheda
pubblica dell'oggetto (`/items/:id`), foto e descrizione comprese, senza che
gli venga mai chiesto di accedere. Nessun `requireUser`/`requireAdmin` in
questa rotta: entrambe le pagine di destinazione sono già protette per conto
proprio, e bloccare qui vorrebbe dire mandare chi non è admin su un 404
invece che sulla scheda, dopo che ha appena inquadrato un adesivo.

**Quello che nasce è una `Request` normale**, già `APPROVED` con il suo
`RequestItem` già `pickedUpAt` — lo stato in cui una richiesta ordinaria
arriva dopo tre passaggi invece che dopo uno. È il motivo per cui questa
funzione non ha richiesto nessuna tabella nuova, e per cui chat, riconsegna,
promemoria automatico e storico funzionano su una consegna diretta senza una
riga in più. Se ti trovi a inventare un modello parallelo per i prestiti
«veloci», fermati: è già tutto lì.

Due regole del percorso ordinario **non** valgono qui, di proposito:

- **Niente tetto di sette giorni né motivo obbligatorio.** Quel tetto frena
  l'autoservizio dei soci, non un admin che ha la persona davanti. Resta il
  tetto assoluto `MAX_SPECIAL_SPAN_DAYS`, che difende dal dito storto.
- **Il controllo di sovrapposizione invece resta, senza eccezioni**
  (`getBusyAssetIds`), insieme a `isBookable`. Un oggetto è uno: consegnarlo
  due volte è la sola cosa che il database non può rimediare dopo.

**Il testo letto dalla fotocamera non è fidato.** Un adesivo è un oggetto
fisico che chiunque passi in magazzino può sostituire con uno stampato in
casa, e un QR può contenere qualunque indirizzo. Vale la stessa regola dei
redirect che arrivano dall'utente: `handoverPathFrom` accetta solo un
indirizzo di *questa* origine col percorso atteso, e **ricostruisce** il
percorso dall'identificativo catturato invece di riusare quello letto — così
query e frammenti non passano. Accetta **due forme**: quella corta e maiuscola
stampata oggi (`/H/CMT3…`) e quella lunga di prima
(`/admin/handover/cmt3…`), che resta valida perché un adesivo già attaccato
non si stacca da solo. Se tocchi quella funzione, ricontrolla i casi: altro
host, `../`, schema `javascript:`, id con una barra dentro, e la coppia
maiuscolo/minuscolo.

Le cose che si scoprono solo sbattendoci:

- **Il QR contiene un indirizzo intero, non l'id nudo.** Costa una trentina di
  caratteri e in cambio l'adesivo funziona anche con la fotocamera di sistema
  del telefono, che di un `cmf3x9k2p0000` non saprebbe che fare.
- **L'indirizzo viene da `APP_URL`**, non dall'origine della richiesta: un
  adesivo è per sempre, e generarli mentre si lavora su `localhost` vorrebbe
  dire stampare etichette morte. Di conseguenza **né `/h/:code` né
  `/admin/handover/:assetId` si rinominano a cuor leggero**: gli adesivi già
  attaccati continuerebbero a puntare lì.
- **`facingMode: "environment"` non basta a prendere la fotocamera giusta.**
  Chiede «una di dietro», e su Android il browser ne consegna spesso una
  qualsiasi — capita la grandangolare, che a venti centimetri da un adesivo
  restituisce un quadratino illeggibile. Le etichette Android hanno la forma
  `camera2 0, facing back`, e **quel numero è l'ordine deciso dal
  produttore**: lo zero è la principale, quella che si apre nell'app
  Fotocamera. `pickRearCamera` (in `admin.scan.tsx`, funzione pura e coperta
  da casi di prova) scarta le posteriori che si dichiarano ultra, tele, macro,
  profondità o monocromatiche e fra le altre prende l'indice più basso. Su
  iPhone non ci sono indici e vale il solo filtro sui nomi — attenzione che
  «wide» da solo **non** va scartato, o si butta via «Back Dual Wide Camera»,
  che è proprio la principale.
  Le etichette esistono **solo dopo** che il permesso è stato dato, quindi
  l'ordine obbligato è: parti con `environment`, poi elenca, poi correggi.
- **La fotocamera parte da sola all'apertura della pagina**, e il pulsante
  resta solo come ritorno quando l'avvio fallisce. Su iOS il permesso viene
  chiesto anche senza un tocco finché la scheda è in primo piano; nei browser
  dentro ad altre app (WKWebView) può non bastare, ed è il caso che il
  pulsante di ripiego copre. Serve una guardia (`startedRef`) contro il doppio
  avvio: in sviluppo React monta e rimonta ogni componente, e senza partirebbero
  due scanner sulla stessa fotocamera.
- **L'adesivo è corto e maiuscolo apposta, e questo è già fatto.** Dentro al
  QR non c'è `/admin/handover/<cuid>` ma `HTTPS://…/H/<CUID>`
  (`shortHandoverUrl` in `qr.server.ts`), e la rotta `h.$code.tsx` rimette in
  minuscolo e rimanda alla consegna. Due trucchi che si sommano: tredici
  caratteri in meno, e il maiuscolo che fa entrare il codice nella **modalità
  alfanumerica** del QR — undici bit ogni due caratteri invece di otto per
  carattere. Una sola minuscola butterebbe tutto in modalità byte.
  Misurato su un adesivo da 4 cm: da 37×37 a **29×29 moduli**, cioè da 1,08 a
  1,38 mm per modulo, +28%. Un modulo più grande è la differenza fra leggere a
  venti centimetri e a quaranta.
  Si potrebbe scendere ancora a 25×25 con un codice di otto caratteri al posto
  del cuid, ma quello vuole una colonna nuova e la sua unicità da garantire:
  non è stato fatto, e va deciso **prima** di stampare gli adesivi.

- **Se un giorno lo scanner risultasse lento, restano due cose da guardare.**

  1. **Su iPhone il decodificatore è quello lento, e non per colpa nostra.**
     Safari non implementa `BarcodeDetector`, e siccome su iOS ogni browser è
     obbligato a usare WebKit non lo implementa nessuno — nemmeno Chrome per
     iPhone. Lì `qr-scanner` ripiega sul suo decodificatore JavaScript.
     L'alternativa è `zxing-wasm` (ZXing-C++ in WebAssembly): circa 2× più
     veloce e più tollerante su codici sfocati o storti. Verificato che legge
     il nostro QR anche disegnato a 80 pixel. **Va però fatto restando dentro
     a un worker** — vedi la trappola del ciclo scritto a mano qui sotto.
  2. **Su Android non c'è niente da guadagnare**: lì `BarcodeDetector` c'è, e
     a leggere è il sistema operativo. Sopra ci sono solo i prodotti
     commerciali a pagamento.

- **`focusMode: "continuous"` è l'accorgimento che cambia di più.** Senza, un
  adesivo a venti centimetri resta sfocato finché la fotocamera non ci ripensa
  da sola, e nel frattempo sembra che lo scanner sia rotto. Su iOS
  `getCapabilities()` non dice quasi niente e la chiamata non fa nulla:
  nessun danno, il telefono mette a fuoco per conto suo.

- **Due strade già provate e scartate, per non rifarle.**

  **Lo zoom automatico** — salire di zoom da soli quando non si legge niente —
  è stato scritto, provato e tolto. Non funziona come sembra: allontana
  l'inquadratura proprio mentre chi scansiona sta centrando l'adesivo. Per
  fare quello che fa Telegram bisognerebbe sapere *dove* è il QR prima di
  averlo letto, e nessun decodificatore raggiungibile da un browser lo
  racconta. Se torna la tentazione, la risposta è no.

  **Riscrivere il ciclo a mano** — fotocamera, cattura dei fotogrammi e
  decodifica scritti qui invece che presi da `qr-scanner`, per poter leggere
  aree più grandi — è stato fatto e annullato dopo la prova sul campo. Sulla
  carta era meglio: `qr-scanner` legge un quadrato centrale ridotto a 400
  pixel, e un ciclo proprio permette di leggere tutto il fotogramma e un
  ritaglio centrale a risoluzione piena. **Nella pratica era peggio**, e il
  motivo è uno solo: `qr-scanner` decodifica in un *web worker*, il ciclo
  scritto a mano lo faceva sul thread principale. Su un telefono si vede —
  l'anteprima scatta e tutto sembra più lento, anche quando la lettura non lo
  è. Chi ci riprova deve partire da lì: **il decodificatore va in un worker**,
  altrimenti non c'è area di lettura che tenga.
- **Lo scanner vale anche da computer, con la webcam.** `preferredCamera:
  "environment"` viene chiesto dalla libreria come vincolo *esatto*, e un Mac
  senza fotocamera posteriore risponde `OverconstrainedError` — verificato.
  Finisce bene lo stesso perché `qr-scanner` riprova senza quel vincolo, ma
  quel ripiego può prendere la fotocamera sbagliata: da qui la tendina di
  scelta, che compare solo con più di una. L'elenco si chiede **dopo**
  l'avvio, perché prima del permesso le etichette arrivano vuote.
- **`Permissions-Policy: camera=()` spegne la fotocamera anche a noi.** La
  lista vuota vuol dire «nessuna origine, noi compresi», non «nessun terzo».
  Quella riga stava in `root.tsx` da prima che esistesse uno scanner, e il
  sintomo era crudele: il browser **non chiedeva mai** il permesso, e darlo a
  mano nelle impostazioni non cambiava niente, perché la decisione era già
  presa dall'intestazione. Ora è `camera=(self)`; microfono, posizione e
  pagamenti restano vuoti perché quelli davvero non servono. Se un giorno lo
  scanner smette di funzionare «senza motivo», questa è la prima riga da
  guardare — `document.featurePolicy.allowsFeature("camera")` risponde in un
  colpo, e `diagnoseCameraFailure` lo chiede per primo apposta.
- **Il `<video>` dello scanner non si nasconde mai con `display: none`.** Un
  video nascosto così non disegna fotogrammi — il canvas che deve leggere il
  QR riceve nero — e `offsetWidth`/`offsetHeight`, con cui `qr-scanner`
  calcola l'area di lettura e piazza la cornice gialla, valgono **zero**
  (misurato). La libreria sistema da sola l'*attributo* `hidden`, ma contro
  una classe CSS non può niente: il sintomo era la fotocamera che si accendeva
  senza mostrare nulla e senza leggere mai un codice, su computer e telefono
  insieme. Il messaggio di stato va **sopra** al video, non al posto suo.
  Per la stessa ragione il contenitore è `relative`: la cornice è un figlio
  assoluto del genitore del video, e senza un genitore posizionato si àncora
  a un antenato qualsiasi.
- **`qr-scanner` non dice mai perché non è partita.** Prova una lista di
  vincoli, inghiotte l'errore di ognuno in un `catch` vuoto e alla fine
  rilancia la stringa `"Camera not found."`: permesso negato e assenza di
  fotocamera arrivano identici, e sono i due casi con la via d'uscita più
  diversa. Per questo `diagnoseCameraFailure` richiede a parte lo stato del
  permesso — senza, a chi negava il permesso si finiva per consigliare HTTPS.
- **`getUserMedia` esiste solo in un contesto sicuro.** `localhost` va bene,
  `192.168.x.x` no: **per provare dal telefono in sviluppo si passa dal
  tunnel Cloudflare**, non dall'indirizzo IP del computer. E il simulatore
  iOS non ha una fotocamera vera — la prova finale si fa su un telefono.

`qr-scanner` e non `BarcodeDetector`: quest'ultimo è già nel browser e non
costerebbe niente, ma **su iOS Safari non esiste affatto**. Si carica con un
`import()` dinamico, sia perché tocca `document` appena viene importata (e
questa pagina viene disegnata anche sul server), sia perché così resta un
chunk a parte da 15KB caricato solo quando la fotocamera parte davvero.

### L'accesso, in breve

Col codice via email **non esiste la differenza fra registrarsi ed entrare**:
scrivi l'indirizzo, ricevi il codice, sei dentro; se l'account non c'era, si
crea. Sparisce la domanda «hai già un account?», che è il punto in cui la gente
si ferma.

Di conseguenza **con la password si può solo entrare, mai registrarsi**: un
account nasce sempre da un codice o da Google, e la password si aggiunge dopo.
È ciò che tiene l'accesso a una schermata sola.

In sviluppo, senza `RESEND_API_KEY`, **il codice viene stampato nel terminale**.
Si prova tutto senza configurare niente.

**Microsoft** è l'ingresso che conta davvero qui: l'associazione sta dentro a
un'università, tutti ne hanno già uno, e l'indirizzo che ne arriva è quello
istituzionale — che dice anche a quale facoltà appartiene chi chiede. Tre cose
da sapere prima di toccarlo:

- **La pretesa `email` è facoltativa** sui conti di un'organizzazione: se chi
  amministra il dominio non l'ha accesa, arriva vuota. Per questo
  `mapProfileToUser` ripiega su `preferred_username` e `upn`, che portano lo
  stesso indirizzo e ci sono sempre. Non togliere quel ripiego.
- **Il nome per esteso dell'università è «Cognome Nome (Facoltà Anno)»** — per
  esempio «Mogno Samuele (Student DES 25)». Cognome davanti, e in coda corso e
  anno di immatricolazione. Diviso ingenuamente al primo spazio mette il
  cognome nel nome e mezzo corso di laurea nel cognome: è successo al primo
  accesso vero. Il nome buono si prende da `given_name` e `family_name`, che
  arrivano separati nel token — **da una stringa sola non si indovina**,
  «Mogno Samuele» e «Samuele Mogno» sono identici da fuori. Le funzioni stanno
  in `lib/person.ts`: `cleanName` toglie la parentesi finale, `givenNameLast`
  legge il formato dell'università (il primo pezzo è il cognome, anche
  composto), `splitName` fa il contrario ed è per tutti gli altri.
  La parentesi **non va nell'alias**: l'alias è ciò che tutti vedono al posto
  del nome (regola 6), e nessuno vuole chiamarsi «Student DES 25».
- **Il tenant è quello dell'università**, non `common`, e non per scelta
  estetica: l'applicazione è registrata dentro alla directory di unibz per una
  sola organizzazione — il valore predefinito del portale — e un'applicazione
  così non può usare l'endpoint condiviso. Microsoft risponde `AADSTS50194`.
  Il GUID sta in `MICROSOFT_TENANT_ID`.
  Di conseguenza **il pulsante Microsoft vuol dire «entra con l'account
  dell'università»**, ed è la ragione per cui l'indirizzo che ne esce è sempre
  quello istituzionale. Chi socio non lo è entra col codice via email, che
  accetta qualunque indirizzo: nessuno resta fuori. Per aprirlo a qualsiasi
  conto Microsoft bisogna cambiare i «tipi di account supportati» nel portale,
  non una riga qui.
- **La foto arriva come dato in linea**, non come indirizzo: Better Auth la
  scarica da Microsoft Graph e la scrive in `image` come
  `data:image/jpeg;base64,…`. `isUploadedAvatar` la tratta giustamente come
  esterna, quindi nessuno prova a cancellarla dal disco — ma `image` viaggia in
  ogni risposta che contiene l'utente, e per questo la misura è fissata a 96
  pixel.

---

## Manutenzione e trasferimento

Requisito esplicito dell'utente: deve essere facile **aggiornare** e **spostare
su un'altra macchina**.

Trasferire = `git clone`, `.env`, `docker compose up -d`, ripristino del dump,
copia della cartella foto. Dieci minuti. Il dominio pubblico è legato al tunnel
Cloudflare e non alla macchina, quindi non cambia nulla per chi usa la
piattaforma: basta riavviare `cloudflared` con lo stesso token.

**Da salvare ci sono solo due cose:** il database e la cartella delle foto. Il
codice sta su Git. Due regole che quasi nessuno rispetta: un backup sulla stessa
macchina non è un backup, e un backup mai ripristinato è una speranza.

Il vero rischio non è il carico — cento e mille utenti sono la stessa
architettura, e al limite non ci si arriva — ma la **disponibilità**: un MacBook
che va in sospensione è la piattaforma offline, e il tunnel non può farci
niente.

### Backup automatico

`scripts/backup.sh` fa esattamente le due cose da salvare: dump compresso e
datato del database, più la cartella foto, caricati su OneDrive via
`rclone`. Girato ogni notte tiene 30 giorni di dump; le foto si copiano
(`rclone copy`, mai `sync`) e non vengono mai cancellate lato OneDrive —
così una cancellazione locale per errore non si propaga mai al backup.

Lo script non contiene mai le credenziali dell'account OneDrive: si
riferisce solo al nome di un remote rclone (`onedrive`). **Spostare il
backup su un altro spazio OneDrive** — cambio di ateneo, account personale —
significa solo `rclone config reconnect onedrive` (o ricreare quel remote
con lo stesso nome): lo script resta invariato.

**Oggi lo script esiste ma non è schedulato.** Per attivarlo (su questa
macchina o dopo il trasferimento su Linux, lo script è identico):

1. Una tantum: `rclone config` → New remote → Microsoft OneDrive → nome
   `onedrive` → segue il flusso OAuth nel browser.
2. Verifica manuale: `./scripts/backup.sh` una volta, poi controllare che
   `onedrive:Fabula-backup/database/` e `.../uploads/` si siano popolate.
3. Solo allora la crontab:
   `0 3 * * * /percorso/fabula/scripts/backup.sh >> /percorso/fabula/data/backup.log 2>&1`

---

## Trappole già incontrate

- **`sortOrder` esisteva ma non lo scriveva nessuno.** Le foto nascevano tutte
  a zero, e siccome il catalogo prende la prima per `sortOrder`, la copertina
  di un oggetto era quella che il database restituiva per prima — poteva
  cambiare da sola. Un campo con un valore di default è un campo che sembra
  funzionare: cercare chi lo *scrive*, non chi lo dichiara.
- **Un `<form>` dentro a un altro `<form>` non esiste.** Il lettore di HTML
  scarta quello interno, quindi l'HTML che arriva dal server non combacia con
  quello che React ricostruisce nel browser. Se dentro a un modulo serve
  un'azione a sé (cancellare una foto mentre stai scrivendo la descrizione),
  la strada è `fetcher.submit()` da un `<button type="button">`, non un
  modulo annidato. Vedi `photo-picker.tsx`.

- **Un menu che si apre col passaggio del mouse e si chiude premendo si
  richiude da solo.** Col mouse sopra è già aperto quando arriva il click,
  quindi un semplice «apri/chiudi» lo spegne nell'istante in cui lo si preme —
  e sul telefono un tocco genera *anche* un `pointerenter`, quindi succede
  anche col dito. La guardia è `pointerType === "mouse"` più il ricordo di chi
  l'ha aperto: vedi `ProfileMenu` in `components/site-header.tsx`. Vale per
  ogni menu a scomparsa che verrà dopo.
- **`prisma migrate status` non vede lo scollamento fra schema e database.**
  Confronta solo le migrazioni fra loro, quindi un campo aggiunto a
  `schema.prisma` senza migrazione risulta «tutto a posto». Il typecheck passa
  pure — il client viene generato dallo schema — e si scopre tutto alla prima
  query, a runtime. **Dopo ogni modifica allo schema, controlla davvero:**
  `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
  deve rispondere «This is an empty migration». È già successo con
  `Request.adminNote`.
- **La directory di lavoro dei comandi torna alla radice del workspace.** Usa
  percorsi assoluti o `pnpm --dir`. Un `pnpm add` lanciato dal posto sbagliato è
  risalito fino alla home dell'utente e ci ha creato un `package.json`.
- **Dopo `prisma generate` il server di sviluppo va riavviato**: tiene in
  memoria il client vecchio e continua a dire che un modello non esiste.
- **Prisma 7**: l'URL di connessione non sta più nello schema ma in
  `prisma.config.ts`, serve un adapter (`@prisma/adapter-pg`), e il `.env` non
  viene più letto da solo.
- **Il seed gira con `tsx`, non con `node`**: il client generato usa import
  senza estensione, che il risolutore ESM di Node rifiuta.
- **Node 26** è troppo recente per il controllo di versione di Prisma, che
  stampa un avviso a ogni installazione. È solo un elenco non aggiornato.
- **`APP_URL` deve combaciare con la porta in uso**, o Better Auth rifiuta
  l'accesso con «Invalid origin». In sviluppo è la 5173.
- **Il `Dockerfile` va tenuto allineato al gestore pacchetti reale.** È nato
  con `npm ci` e un `package-lock.json` quando il progetto è passato a pnpm
  nessuno lo ha aggiornato: il container `app` non si è mai più costruito,
  fallendo silenziosamente ogni volta (nessuno se n'è accorto perché
  `docker compose up -d` senza `--profile full` non prova nemmeno a
  costruirlo). Ora usa pnpm via corepack, con `pnpm-workspace.yaml` copiato
  anche negli stage con `--prod` (contiene gli `allowBuilds` per Prisma) e
  il comando di avvio che chiama `react-router-serve` direttamente invece di
  passare da `pnpm run start` — quel giro triggera un controllo automatico
  delle dipendenze che, senza `pnpm-workspace.yaml` nell'immagine finale,
  fallisce e mette il container in crash-loop. **Lo stesso controllo scatta su
  `pnpm exec`**: lo stadio che chiama `prisma generate` deve avere accanto i
  manifesti, o conclude che non è installato niente e prova a reinstallare,
  fallendo con `ERR_PNPM_NO_PKG_MANIFEST`.
- **L'ordine delle righe nel `Dockerfile` è la sua velocità.** Docker riusa una
  riga solo se tutto ciò che sta sopra è identico, quindi i manifesti vanno
  copiati **da soli, prima del sorgente**. Con `COPY . /app` prima di
  `pnpm install` — com'era — bastava toccare un commento per invalidare
  l'installazione e ripagare mezzo giga di dipendenze, `sharp` nativo
  compreso: **48 secondi misurati, contro 4 dopo il riordino**, dove si
  rifanno solo `COPY . .` e `vite build`. Se un giorno queste righe sembrano
  scritte in un ordine strano, è questo il motivo.
- **`.dockerignore` è anche una barriera per i segreti, non solo un
  acceleratore.** Non conteneva `.env`: i segreti non arrivavano
  nell'immagine finale — l'ultimo stadio copia solo `build` e `node_modules` —
  ma finivano negli **strati intermedi**, che restano nella cache del daemon e
  si leggono con `docker history`. Ora il `.env` è escluso, e il build non ne
  ha bisogno: `prisma generate` legge `DATABASE_URL` da un valore finto
  dichiarato nel `Dockerfile`, perché non si collega a nessun database.
  Escluse anche `data` (le foto dei soci, che stanno in un volume) e
  `app/generated` (il client Prisma **deve** essere quello generato dentro al
  container, non quello vecchio sul computer di chi costruisce).
- **`docker compose up -d` da solo avvia solo `db`.** Il servizio `app` sta
  dietro `profiles: ["full"]` apposta, per separare lo sviluppo (solo
  database, col codice che gira fuori con `pnpm dev`) dalla produzione.
  Serve `docker compose --profile full up -d` per avere anche l'app — è
  facile dimenticarselo e restare con l'app ferma senza errori evidenti.
- **La porta pubblica dell'app (`APP_PORT`) deve combaciare con il
  "Service" configurato per l'hostname pubblico nel tunnel Cloudflare**
  (Zero Trust → Networks → Tunnels → il tunnel → Configure). Sono due
  configurazioni indipendenti — una nel `.env` locale, l'altra nella
  dashboard Cloudflare — e nulla le tiene sincronizzate: se divergono,
  Cloudflare risponde 502 anche con l'app perfettamente sana in locale.
- **Docker Desktop deve avere «Start Docker Desktop when you log in»
  attivo** (Settings → General). Senza, un riavvio del Mac non fa ripartire
  nulla nonostante `restart: unless-stopped` sui container — Docker stesso
  non è in esecuzione finché non lo si apre a mano.

---

## Convenzioni

- Commenti in italiano, che spiegano **perché** e non cosa. Se una scelta è
  controintuitiva, il commento deve dire da quale problema nasce.
- Ogni file si apre con un blocco che dice a cosa serve.
- Mai `any` per comodità.
- **Una rotta con più azioni POST le distingue con un campo nascosto
  `intent`** (`<input type="hidden" name="intent" value="..." />`), letto in
  cima all'`action` con `String(form.get("intent"))`. Vedi
  `request-detail.tsx` (`message` / `editDates` / `cancel` / `note` /
  `approve` / `reject` / `pickup` / `return` / `reminder`) o
  `admin.members.tsx` (`toggleRole` / `sendReset`). Chi aggiunge un'azione
  nuova a una rotta esistente segue questo schema invece di crearne una
  parallela; chi legge un `action` cerca prima la lista degli `intent`
  gestiti, che di solito sta tutta in cima alla funzione.
- `"min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"` è scritta a
  mano in otto punti fra `asset-fields.tsx`, il catalogo e le date. Prima o poi
  diventa `fieldClass()` accanto a `buttonClass()`: è lo stesso difetto che ha
  fatto nascere la regola 7, solo non ancora costato niente.
- Verifica sempre nel browser, non solo con `typecheck`: parecchi difetti di
  questo progetto (la lingua che si azzerava alla registrazione, le origini
  rifiutate) passavano indenni il controllo dei tipi.
- Non fare commit senza che l'utente lo chieda.
