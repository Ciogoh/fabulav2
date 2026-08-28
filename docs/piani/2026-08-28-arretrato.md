# L'arretrato — quello che resta da fare

Le voci della lista del 28 agosto 2026 che **non** sono entrate nel giro di
[Fabula 0.7](2026-08-28-centro-chat-promemoria.md). Nessuna è stata scartata:
sono state rimandate, e qui c'è già scritto come si fanno, così quando si
riprende non si ricomincia dal ragionamento.

**Sono in ordine di quanto costa non farle**, non di quanto costano. La voce B
— i backup — è l'unica che protegge da un danno che non si rimedia, e va prima
di tutte le altre a prescindere da cosa sembra più urgente.

> **La voce A è stata fatta** subito dopo, in parallelo: PWA installabile,
> notifiche push e scelta del canale nel profilo sono dentro alla 0.7. È
> rimasta qui sotto perché il ragionamento che la riguarda serve ancora — in
> particolare le prove su dispositivi veri, che restano da fare.
>
> **Aggiornamento del 28 agosto 2026: le notifiche push sono `EXPERIMENTAL`
> e spente.** Chiavi VAPID impostate ovunque, giro provato per intero —
> iscrizione salvata, `web-push` la manda senza errori — ma su desktop
> (macOS + Brave) non compare mai niente a schermo, e la causa non si è
> isolata da remoto. `PUSH_NOTIFICATIONS_ENABLED = false` in
> `push.server.ts` la spegne con una bandiera sola. Da riprendere insieme
> alle prove su dispositivi veri qui sotto, non prima.

---

### A. Notifiche push e PWA installabile — *il piano è già scritto*

`docs/piani/2026-08-24-pwa-notifiche.md`, per intero e ben ragionato: guscio
installabile, `web-push`, `PushSubscription` per dispositivo, `NotifyChannel`
sul profilo, il dispatcher `deliver()`, e la regola che **codice di accesso e
reset password restano email per chiunque**.

**Tre delta che nascono da questo piano:**

1. **Il prerequisito del rebrand cade** (tua scelta di oggi): si generano icone
   provvisorie con `scripts/icons.ts` e `sharp`, che è già una dipendenza. Al
   rebrand si sostituisce l'SVG sorgente e si rilancia il comando.
2. **Gli eventi da notificare sono aumentati**: i messaggi di chat (Fase 5) e i
   quattro promemoria (Fase 6). Il punto di innesto è già pronto:
   `sendReminder`, una funzione sola.
3. **Il service worker non deve toccare `/api/stream`.** Un flusso SSE
   intercettato da un `fetch` handler che non lo capisce si rompe in modi
   difficili da diagnosticare. Una riga di guardia e un commento che dice
   perché.

**Costo**: due giornate e mezza. **Costo di non farla**: gli admin restano
legati alla posta, che è il problema da cui è nato quel piano.

---

### B. Backup automatici su R2 — *la sola voce che protegge da un danno irreversibile*

Da salvare ci sono due cose: **il database** e **la cartella delle foto**. Il
codice sta su Git.

- **Database** → backup programmato **di Coolify**, destinazione S3 su **R2**.
  È il servizio integrato: conosce le credenziali, mostra lo stato, e un
  fallimento fa scattare la notifica. Endpoint
  `https://<account-id>.r2.cloudflarestorage.com`, bucket privato, region
  `auto`, token API **limitato a quel solo bucket**, ritenzione 30 giorni.
- **Foto** → Coolify non salva i volumi. `scripts/backup-uploads.mjs`: ESM
  puro, niente `tsx`, unica dipendenza `@aws-sdk/client-s3` (~2 MB), copiato
  nell'immagine dal `Dockerfile`, eseguito come **Scheduled Task di Coolify**.
  Confronta dimensione e data e **carica solo ciò che è cambiato**. Non
  cancella mai niente su R2: una cancellazione locale per errore non deve
  propagarsi al backup.

**R2 basta? Sì.** Piano gratuito: 10 GB, 1 milione di scritture al mese, 10
milioni di letture, **traffico in uscita gratuito** — ed è quest'ultima riga
che lo fa vincere su S3. Qualche centinaio di foto sta sotto il gigabyte;
trenta dump di questo database stanno in decine di megabyte. Due ordini di
grandezza di margine.

**Come non sforare**, cinque difese che si sommano — R2 **non** ha un tetto di
spesa automatico, quindi la protezione è operativa:

1. la taglia, di cui sopra;
2. **regola di ciclo di vita** sul bucket: gli oggetti sotto `database/`
   scadono a 35 giorni. Le cancellazioni non si pagano, e la crescita è tappata
   alla radice invece di dipendere da chi se ne accorge;
3. lo script carica **solo i cambiati**: decine di operazioni al giorno, non
   migliaia come farebbe un `sync` cieco;
4. il bucket resta **privato**: niente dominio pubblico, nessuno può generare
   traffico da fuori;
5. **avviso di spesa a 1 €** nella dashboard, e token limitato a un bucket
   solo: anche se sfuggisse, non tocca nient'altro.

**Un dump contiene email, nomi e sessioni.** Bucket privato di un account tuo,
cifrato a riposo da Cloudflare. Se vuoi di più, `age` prima del caricamento
sono tre righe — ma la chiave va nel gestore di password, o il backup diventa
illeggibile proprio il giorno in cui serve.

**E la regola che vale più di tutte**: un backup mai ripristinato è una
speranza. `docs/restore.md` con la procedura, e **la prima prova si fa subito**,
non il giorno del guasto. In fondo al documento, una riga «ultimo ripristino di
prova: ___» da riempire a mano.

`scripts/backup.sh` (OneDrive) resta come via di fuga, con una riga in testa
che dice qual è quello vivo.

**Costo**: mezza giornata mia più il tuo tempo nei pannelli.
**Costo di non farla**: tutto.

---

### C. Cloudflare Tunnel «come si deve»

**Prima cosa, e va fatta comunque**: `docs/coolify.md` **si contraddice**. Il
capitolo 3c dice che `cloudflared` sta sulla rete del progetto e punta a
`http://fabula:3000`; la fotografia «Com'è configurato oggi» dice
`network_mode: host` e `http://localhost:80`. **La seconda è quella vera, ed è
anche quella giusta**: il container dell'app si chiama `<uuid>-<timestamp>` e
quel nome cambia a ogni rilascio, quindi puntandogli dritto Cloudflare andrebbe
riconfigurato a ogni push, mentre Traefik lo ritrova dall'intestazione `Host`.
Va corretto il documento.

Poi, ciò che manca per chiamarlo fatto per bene — quasi tutto nei pannelli:

- **`cloudflared` pinnato a una versione**, non `:latest`, e aggiornamento
  automatico spento. Un `latest` che cambia sotto i piedi è il sito giù senza
  che nessuno abbia spinto niente.
- Il token del tunnel **sulla risorsa `cloudflared` e non sull'applicazione**:
  verificare che sia lì e solo lì.
- **Regola di cache**: tutto in bypass (è un'applicazione dinamica) **tranne**
  `/assets/*` e `/uploads/*`, che sono immutabili per costruzione — nomi
  firmati o UUID. È il guadagno vero di avere Cloudflare davanti: le foto
  smettono di passare da Node.
- **Rate limiting su `/api/auth/*`**, 20 richieste al minuto per IP. Il limite
  in memoria di Better Auth resta la seconda linea; questa è la prima, e
  sopravvive al riavvio del processo.
- WAF gestito acceso, **Bot Fight Mode spento** (blocca richieste legittime e
  non serve dietro un tunnel).
- **Consigliato**: la dashboard di Coolify (8000) dietro **Cloudflare Access**
  con codice via email, al posto di Tailscale. Toglie di mezzo per sempre la
  contesa sulla 443 che è già costata mezza giornata, e non lascia
  configurazioni fuori standard nel database di Coolify.

---

### D. Il calendario personale, con il luogo di riconsegna — *fatto, 28 agosto 2026*

> Costruito com'era disegnato qui sotto, con due scarti dichiarati rispetto al
> piano originale:
>
> 1. **Niente pulsante «revoca» separato.** La sezione del profilo è sempre
>    aperta, quindi un token tolto ne farebbe nascere subito uno nuovo — dire
>    la verità su cosa succede davvero (rigenerare invalida il vecchio) è più
>    chiaro che offrire una revoca che un istante dopo lascerebbe comunque un
>    collegamento valido in vista.
> 2. **Il `/calendar.ics` pubblico è stato tolto, non lasciato accanto al
>    personale** — decisione presa a lavoro fatto: ognuno deve avere il
>    proprio calendario, non uno condiviso da rileggersi cercando le proprie
>    righe in mezzo a quelle di tutti. Uscito insieme: la sezione
>    «Aggiungi al tuo calendario» in `/calendar` (`SubscribeBox`), le sue
>    quattro chiavi di traduzione, e la rotta stessa. Per lo stesso motivo il
>    feed `?scope=all` per gli admin, già facoltativo qui sotto, non si fa più:
>    sarebbe di nuovo un calendario di tutti invece che il proprio.

**Il difetto**: `/calendar.ics` è uno solo, pubblico, con **tutti** i prestiti.
Chi lo aggiunge si riempie l'agenda delle occupazioni di chiunque e non vede da
nessuna parte i propri.

**Il disegno**: `User.calendarToken` (32 byte da `randomBytes`, base64url),
creato pigramente alla prima apertura della sezione nel profilo. Rotta
`/cal/<token>.ics` che restituisce solo i prestiti di quella persona:
`APPROVED` **e** `PENDING`, questi ultimi marcati `STATUS:TENTATIVE` — tua
scelta, così si distinguono a colpo d'occhio.

Dentro a un evento: `X-WR-CALNAME` col nome della persona, `SUMMARY` col nome
dell'oggetto, **`LOCATION` = `Asset.location`** (dove ritirarlo e riportarlo),
`DESCRIPTION` con periodo e collegamento, e un `VALARM` il giorno prima della
scadenza. Se la richiesta ha oggetti in posti diversi si genera **un evento per
oggetto**, altrimenti la `LOCATION` sarebbe una sola e mentirebbe.

> **Il token è una credenziale**, e va scritto in `CLAUDE.md`: chi ce l'ha vede
> i prestiti di quella persona, posizioni comprese. Da qui:
> `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`, mai in un log,
> **404 muto** per un token sbagliato (nessun messaggio che distingua
> «inesistente» da «revocato»), e la revoca a un clic dal profilo.

**Deciso dopo, non nel disegno originale**: il `/calendar.ics` pubblico è
stato **rimosso** invece di restare accanto al personale — vedi il richiamo
in cima al capitolo. Per lo stesso motivo cade anche l'idea qui sotto di un
secondo feed per admin con tutti i prestiti: sarebbe stato di nuovo un
calendario di tutti, quando l'obiettivo è che ognuno abbia il proprio.

~~**Facoltativo**: un secondo feed per admin, `?scope=all`, con tutti i
prestiti e il nome di chi li ha. Utile per il turno in magazzino, ma è il
feed che se sfugge racconta a chiunque chi ha cosa.~~

**Costo**: mezza giornata.

---

### E. Guide, manuali e disclaimer sugli oggetti

**Il caso che hai descritto**: chi prenota una bici deve sapere come funziona
il carrello. Oggi l'unico posto è la descrizione, che è pubblica e si legge
prima di prenotare — cioè nel momento sbagliato.

**Schema**: `enum GuideKind { GUIDE  DISCLAIMER }`, `model AssetGuide`
(titolo, testo, file PDF facoltativo, ordine), e `Request.guidesAckAt` per la
dichiarazione «ho letto».

**I file non passano da `/uploads/*`**, e la ragione è precisa: quella rotta è
pubblica per costruzione (le foto del catalogo si vedono senza accesso) e serve
**tutto** ciò che sta sotto `UPLOAD_ROOT`. Quindi: i file stanno in
`data/uploads/guides/`, **`routes/uploads.tsx` guadagna un elenco di ammessi**
(`assets/` e `avatars/`, tutto il resto 404 — irrobustimento che vale da solo),
e una rotta nuova `routes/guides.$id.tsx` con `requireUser` li serve. Solo PDF,
verificato sui **byte** (`%PDF-`) e non sull'estensione, tetto 10 MB — stessa
regola di `looksLikeImage`.

**Dove compaiono**, in ordine di utilità: (1) **nell'email di approvazione**,
che è il momento in cui chi ha chiesto ha motivo di leggerle; (2) sulla pagina
della richiesta, con la spunta «Ho letto» se c'è un disclaimer; (3) **sulla
schermata di consegna**, dove l'admin che ha la persona davanti è l'ultimo
controllo utile e a voce ci mette dieci secondi; (4) i soli titoli sulla scheda
pubblica dell'oggetto.

**Costo**: una giornata.

---

### F. Il calendario delle prenotazioni, mobile e desktop

**Cosa non si tocca**: righe = oggetti, colonne = giorni. Una griglia mensile
mescola le prenotazioni dentro alle caselle dei giorni, e «quando è libera la
videocamera?» richiede di leggere trenta caselle.

**Cosa manca**, in ordine di guadagno:

1. **Si guarda il calendario ma non ci si prenota da lì.** È il salto grosso:
   trascinare sulle celle vuote di una riga seleziona un periodo e apre lo
   stesso foglio di richiesta del carrello, già compilato. Da telefono, due
   tocchi. Il foglio va estratto in `components/request-dialog.tsx` e
   condiviso, non riscritto (regola 7).
2. **La finestra è fissa a 35 giorni**: un comando a tre posizioni,
   2 settimane · 5 settimane · 3 mesi, ricordato in `localStorage`.
3. **Non si può cercare**: ricerca per nome e filtro per categoria, negli
   stessi parametri dell'indirizzo del catalogo, così un calendario filtrato si
   può mandare a qualcuno per messaggio.
4. **«Oggi» è una colonna colorata**: diventa una linea verticale continua. Una
   colonna tinta si confonde con una barra.
5. **Sul telefono manca la risposta breve**: l'elenco per oggetto resta — è la
   scelta giusta — ma ogni riga guadagna una **striscia di sette caselle**, i
   prossimi sette giorni, coi colori della Fase 3, più un pulsante «Prenota».
6. **Le barre dicono poco**: nome dentro quando sono larghe, e per gli admin il
   nome di chi ce l'ha — che oggi sta solo nel suggerimento del passaggio del
   mouse, **che sul telefono non esiste**.
7. **Da tastiera è un muro**: ogni barra diventa un `<a>` vero con un
   `aria-label` per esteso.

**Costo**: due giornate, ma **spezzabile**: i punti 3, 4, 6 e 7 sono mezza
giornata in tutto e valgono già molto.

---

### G. Telegram per i guasti

Due livelli, che vedono cose diverse e servono tutti e due.

**Livello 1 — Coolify → Telegram**, dai pannelli: rilascio fallito, container
fermato, server irraggiungibile, backup fallito, scheduled task fallita. È il
servizio integrato, e vede l'**infrastruttura**.

**Livello 2 — Fabula → Telegram**, `app/lib/alerts.server.ts`. Coolify non vede
i guasti *dentro* all'applicazione: email non partita, giro dei promemoria in
errore, errore non gestito lato server, `/healthz` che fallisce sul database.
Stessa forma di `email.server.ts`: senza `TELEGRAM_BOT_TOKEN` e
`TELEGRAM_CHAT_ID` **non fa niente e non si lamenta**, come Resend in sviluppo.

**Con un antirimbalzo obbligatorio**: massimo un messaggio all'ora per tipo di
guasto. Un errore che si ripete mille volte deve produrre un avviso, non
mille — altrimenti si silenzia il bot e si perde anche il prossimo, che era
quello importante.

**Livello 3, consigliato**: il controllo di salute di Coolify gira **sul**
server. Se muore la macchina, non avvisa nessuno. Un Worker Cloudflare con un
cron ogni cinque minuti che chiama `/healthz` sono venti righe e costa zero;
in alternativa UptimeRobot, gratuito e senza codice.

---

### H. Documentazione, segreti, chiavi, pulizia

**`docs/segreti.md`**, con una regola sopra a tutto:

> **Nel repository non entra nessun valore, mai.** Il documento elenca *quali*
> segreti esistono, *dove* vivono, *come* si ruotano e **cosa si rompe** quando
> li si ruota. I valori stanno in un gestore di password (una raccolta «MaMa»
> condivisa fra chi amministra), e da nessun'altra parte.

La colonna che conta è l'ultima:

| Segreto | Cosa si rompe se lo cambi |
| --- | --- |
| `SESSION_SECRET` | **tutti fuori**, devono rientrare |
| `CLOUDFLARE_TUNNEL_TOKEN` | fatto male: **sito giù** |
| `RESEND_API_KEY` | niente email, quindi **niente accessi** |
| `VAPID_*` (voce A) | **tutte** le iscrizioni push muoiono in silenzio |
| `GOOGLE_*` / `MICROSOFT_*` | quel pulsante smette; il codice via email regge |
| `POSTGRES_PASSWORD` | va cambiata **anche** nella `DATABASE_URL`, o l'app è giù |
| Chiavi R2 (voce B) | backup fermi **in silenzio** — da qui l'avviso Telegram |
| Chiave SSH | **fuori dal tuo server**, se sbagliata |

**Rotazione SSH, nell'ordine che non chiude fuori nessuno**: si genera la nuova
(`ssh-keygen -t ed25519`), si copia sul server, **si prova a entrare**, e
**solo dopo** si toglie la vecchia da `authorized_keys` e si aggiorna la chiave
dentro Coolify. Poi si verifica `PasswordAuthentication no` e
`PermitRootLogin prohibit-password`. Mai togliere la vecchia prima di aver
provato la nuova: è il modo classico di restare fuori dal proprio server.

**Pulizia del server**, una volta: container fermi di ieri, volumi orfani dei
rilasci vecchi, `ufw status` (deve esserci solo la 22), `ss -tlnp` per vedere
chi ascolta davvero, `authorized_keys` per vedere chi entra, e i residui di
Tailscale Serve sulla 443 (risolti il 27 agosto, ma vanno controllati che non
tornino).

**Il mini manuale, due artefatti** — e sono due per una ragione: un documento
nel repository non lo apre mai un volontario che deve consegnare una bici.

- **`docs/manuale-interno.md`**, per chi mantiene: cos'è Fabula, com'è fatta,
  chi chiamare, e il **runbook** delle trappole già pagate — davanti a un 502
  guarda il proxy prima dell'indirizzo; se il proxy non parte guarda chi occupa
  la 443; se il rilascio non passa guarda le prime righe dei log, che sono le
  migrazioni.
- **`/admin/help`, una pagina dentro all'applicazione**, in tre lingue, per i
  volontari: come si approva, come si consegna col QR, cosa vuol dire «in
  ritardo», cosa **non** fare (non cancellare un oggetto già prestato: si
  archivia; non cambiare le date di una richiesta approvata senza dirlo, perché
  torna in attesa).

---

### I. Build, aggiornamenti seamless, vulnerabilità

**La build e la versione.** `pnpm check` (= typecheck + test + build) come
comando unico prima di spingere; `docker build` in locale, che è la stessa
immagine della produzione; e `/healthz` che **restituisce anche la versione** in
JSON, così «cosa sta girando davvero là fuori?» si risponde con un `curl`,
senza aprire una pagina e senza essere admin. In produzione, la riga di
versione in fondo a `/admin/log` deve mostrare lo **sha vero**: se dice `?` o
`build 1`, il passaggio di `SOURCE_COMMIT` si è rotto e nessuno se ne
accorgerebbe mai.

**Gli aggiornamenti.** Il meccanismo è già buono — `git push`, migrazioni
all'avvio, ritorno automatico alla versione precedente se `/healthz` non
risponde. **Manca il controllo prima di spingere.** CI su GitHub Actions a ogni
push: install, typecheck (che copre anche le traduzioni mancanti), test,
`docker build` (il `Dockerfile` si è già rotto una volta in silenzio per mesi),
`pnpm audit`, e soprattutto **il controllo che manca oggi**: Postgres di
servizio, `migrate deploy`, poi `migrate diff` — se non è vuoto, **schema
cambiato senza migrazione**, e la build fallisce *prima* della produzione
invece che dentro.

Poi **Renovate**: PR settimanali raggruppate, patch e minor insieme, major una
per una. Con la CI come cancello, una PR verde si fonde con fiducia; **senza
CI, un aggiornamento automatico è solo un modo più veloce di rompersi.**

Da scrivere nel manuale: l'**aggiornamento maggiore di Postgres non è
automatico** e non lo farà Coolify — è dump, risorsa nuova, restore, e si fa
con calma quando lo si decide.

**Vulnerabilità.** Revisione col `security-reviewer` che questo progetto ha già
e che conosce le sue regole, su ogni superficie nuova; `pnpm audit` e
`osv-scanner` sul lockfile; i cookie di sessione **visti** nel pannello
Applicazione e non dati per buoni (`Secure`, `HttpOnly`, `SameSite=Lax`);
riprova delle difese già in elenco (tre codici al minuto poi 429; una rotta
admin da non-admin deve dare **404** e non 403).

**La voce grossa rimasta aperta: la CSP con i nonce.** Oggi c'è solo
`frame-ancestors 'none'`, e la ragione è scritta — React Router mette in pagina
uno script in linea con i dati dei loader. Con React Router 8 si può: nonce
generato per risposta in `entry.server.tsx`, passato a `<Scripts nonce>` e
`<ScrollRestoration nonce>`. Mezza giornata, e va provato bene: sbagliato
**rompe la pagina intera in modo evidente** — che, per una volta, è il tipo
buono di errore.
