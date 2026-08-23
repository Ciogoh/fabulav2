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

**Funziona ed è stato verificato dal vivo, non solo compilato:**

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
  premendo il proprio nome in cima)

**Manca**, in quest'ordine di priorità:

1. **Le date si scelgono al momento di prenotare, non in cima al catalogo.**
   Via i due campi data dall'alto: si sfogliano gli oggetti, e le date si
   indicano premendo «Richiedi». **Massimo sette giorni**; oltre, una spunta
   apre la «richiesta speciale».
2. Invio vero delle richieste (il carrello oggi non ha dove finire)
3. Pannello admin: approvare, segnare ritiro e riconsegna. **Il catalogo
   lato admin è fatto**: oggetti (con ricerca, filtro e gruppi per categoria),
   categorie e kit, tutti e tre sotto le stesse tre schede. Una categoria si
   crea anche dal menu a tendina della scheda di un oggetto, senza uscire.
4. Promemoria di riconsegna via email (il giorno prima della scadenza)
5. ~~Caricamento delle foto~~ — **fatto**, con anteprima prima di spedire
6. ~~Ottimizzazione per telefono~~ — **fatta.** Il `<nav>` non traboccava solo
   sul calendario: era largo 466px dentro a uno schermo da 375, quindi *ogni*
   pagina scorreva in orizzontale e il foglio della richiesta usciva storto.
   Il calendario sotto ai 640px non è più una timeline ma un elenco oggetto
   per oggetto; sopra, la colonna dei nomi è `sticky`.
7. **Allineamento visivo a Material Matters** (vedi *Aspetto*) — resta il
   pezzo grosso, ma adesso è quasi solo una sostituzione di valori.
8. *Un giorno:* QR sugli oggetti

Le prime cinque voci di questo elenco descrivono uno stato superato: dialogo
delle date, invio delle richieste, pannello admin e foto funzionano. Chi passa
di qui per primo le poti.

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

## Le regole che non vanno rotte

### 1. Gli stati non si salvano mai

Libero, Prenotato e In uso si **calcolano** dalle prenotazioni attive
(`app/lib/availability.server.ts`). Aggiungere un campo `stato` sull'oggetto
crea un dato che prima o poi mentirà. Vale anche per lo stato della richiesta.

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
serie: accendilo solo dopo `requireAdmin`.

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
| `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`, `Permissions-Policy` | `root.tsx` `headers()` | presenti nella risposta |
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
- **Nessun registro delle azioni degli admin.** Quando arriva il pannello,
  approvazioni e rifiuti andrebbero tracciati.
- **Le foto non sono ancora caricabili**: quando lo saranno, validare il tipo
  reale del file e non l'estensione, e ridimensionare al caricamento.

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
  routes/catalogue.tsx        il catalogo pubblico, con ricerca
  routes/admin.assets.tsx     gli oggetti: ricerca, filtro e gruppi per categoria
  routes/admin.categories.tsx le categorie: crea, rinomina, riordina, elimina
  routes/admin.kits.tsx       i kit, con i pezzi in chiaro su ogni riga
  routes/item.tsx             la scheda di un oggetto (pubblica)
  routes/availability.tsx     sole risorse: «liberi in queste date?»
  routes/calendar.tsx         la timeline oggetti × giorni, elenco sul telefono
  routes/calendar[.]ics.tsx   il feed iCal pubblico
  routes/account.tsx          il proprio profilo: foto, nome, alias
  routes/signin.tsx           accesso
  routes/welcome.tsx          il nome, chiesto una volta
  routes/api.auth.$.tsx       gestore unico di Better Auth
  components/button.tsx       l'unico pulsante
  components/page.tsx         l'unico guscio di pagina
  components/cart-bar.tsx     il carrello e il foglio della richiesta
  components/state-badge.tsx  i quattro stati, mai solo colore
  components/select.tsx       l'unico menu a tendina
  components/photo-picker.tsx le foto: quelle che ci sono e quelle in arrivo
  components/person.tsx       <PersonName> e <Avatar>
  components/admin-tabs.tsx   oggetti · kit · categorie, le tre schede admin
  components/kit-fields.tsx   il modulo di un kit e il selettore dei pezzi
  components/date-range-fields.tsx  le date, condivise fra foglio e dettaglio
  lib/availability.server.ts  il motore di disponibilità
  lib/availability.shared.ts  i tetti di durata, anche per il browser
  lib/person.ts               alias, nome per esteso, etichetta per gli admin
  lib/categories.ts           slug e nome ripulito, anche per il browser
  lib/categories.server.ts    la categoria creata dalla scheda di un oggetto
  lib/kits.server.ts          gli oggetti da spuntare, e la riscrittura dei pezzi
  lib/initials.ts             le iniziali per i segnaposto
  lib/session.server.ts       getUser / requireUser / requireAdmin
  lib/auth.server.ts          configurazione dell'accesso
  lib/email.server.ts         Resend, con ripiego a terminale
  lib/ical.server.ts          generazione iCalendar
  i18n/                       tre lingue, tipizzate + i titoli delle pagine
  app.css                     i token, con i rapporti di contrasto annotati
  lib/uploads.server.ts       foto degli oggetti (due file) e avatar (uno)
prisma/schema.prisma          nove tabelle + quattro di Better Auth
```

`availability.shared.ts` esiste per una ragione sola: `availability.server.ts`
importa il database, quindi un componente che ne prendesse `MAX_ORDINARY_SPAN_DAYS`
si porterebbe Prisma dentro al pacchetto del browser. I due tetti di durata
servono da entrambe le parti e devono restare **lo stesso numero**.

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

---

## Convenzioni

- Commenti in italiano, che spiegano **perché** e non cosa. Se una scelta è
  controintuitiva, il commento deve dire da quale problema nasce.
- Ogni file si apre con un blocco che dice a cosa serve.
- Mai `any` per comodità.
- `"min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"` è scritta a
  mano in otto punti fra `asset-fields.tsx`, il catalogo e le date. Prima o poi
  diventa `fieldClass()` accanto a `buttonClass()`: è lo stesso difetto che ha
  fatto nascere la regola 7, solo non ancora costato niente.
- Verifica sempre nel browser, non solo con `typecheck`: parecchi difetti di
  questo progetto (la lingua che si azzerava alla registrazione, le origini
  rifiutate) passavano indenni il controllo dei tipi.
- Non fare commit senza che l'utente lo chieda.
