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

- Catalogo pubblico senza account, con i tre stati (Libero / Prenotato / In uso)
  e il filtro per periodo
- Kit, che si sciolgono nei loro pezzi dentro al carrello
- Interfaccia in inglese, italiano e tedesco
- Accesso: codice via email (principale), password, Google (spento finché
  mancano le chiavi)
- Email da Resend, dominio `fabulabz.com` verificato
- Calendario a righe-oggetto per colonne-giorno, con esportazione iCal pubblica
- Intestazioni di sicurezza e limite di frequenza sull'accesso, provati

**Manca**, in quest'ordine di priorità:

1. **Le date si scelgono al momento di prenotare, non in cima al catalogo.**
   Via i due campi data dall'alto: si sfogliano gli oggetti, e le date si
   indicano premendo «Richiedi». **Massimo sette giorni**; oltre, una spunta
   apre la «richiesta speciale».
2. Invio vero delle richieste (il carrello oggi non ha dove finire)
3. Pannello admin: creare oggetti, approvare, segnare ritiro e riconsegna
4. Promemoria di riconsegna via email (il giorno prima della scadenza)
5. Caricamento delle foto
6. **Ottimizzazione per telefono** — il catalogo regge, il calendario no
7. Allineamento visivo a Material Matters (vedi *Aspetto*)
8. *Un giorno:* QR sugli oggetti

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

**Il feed iCal è pubblico per costruzione.** Un indirizzo `.ics` non può chiedere
chi sei — i programmi di calendario lo scaricano e basta — quindi tutto ciò che
contiene è pubblico. Solo nome dell'oggetto e date. Le richieste in attesa
restano fuori.

**Ogni `redirect` verso un percorso che arriva dall'utente va filtrato**
(`next`, `redirectTo`). Deve cominciare per `/` e **non** per `//`, altrimenti è
un redirect aperto verso un altro sito. Vedi `signin.tsx`, `welcome.tsx`,
`language.tsx`.

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

I colori sono tutti token in `app/app.css`, quindi il cambio è quasi solo una
sostituzione di valori. **Ogni colore va definito anche fuori dal blocco del
tema scuro**, o sparisce nel tema chiaro.

**Il telefono conta.** L'associazione consegna oggetti di persona, quindi la
piattaforma verrà usata in magazzino col telefono in mano. Il catalogo regge
già; il calendario a timeline no, e va ripensato per schermi stretti.

---

## Struttura

```
app/
  routes/catalogue.tsx        il catalogo pubblico
  routes/calendar.tsx         la timeline oggetti × giorni
  routes/calendar[.]ics.tsx   il feed iCal pubblico
  routes/signin.tsx           accesso
  routes/welcome.tsx          il nome, chiesto una volta
  routes/api.auth.$.tsx       gestore unico di Better Auth
  lib/availability.server.ts  il motore di disponibilità
  lib/session.server.ts       getUser / requireUser / requireAdmin
  lib/auth.server.ts          configurazione dell'accesso
  lib/email.server.ts         Resend, con ripiego a terminale
  lib/ical.server.ts          generazione iCalendar
  i18n/                       tre lingue, tipizzate
prisma/schema.prisma          nove tabelle + quattro di Better Auth
```

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
- Verifica sempre nel browser, non solo con `typecheck`: parecchi difetti di
  questo progetto (la lingua che si azzerava alla registrazione, le origini
  rifiutate) passavano indenni il controllo dei tipi.
- Non fare commit senza che l'utente lo chieda.
