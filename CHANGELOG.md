# Cosa è cambiato

Qui si legge come cresce Fabula. Le voci dicono **perché**, non solo cosa: il
codice racconta già com'è fatto, e la domanda che arriva dopo è sempre l'altra.

Il numero di versione è un giudizio, deciso a mano quando un pezzo di lavoro
finisce — non sale da solo. Il suo significato, e il rito che tiene insieme
piani, changelog e versione, stanno nel capitolo *Versione* di
[`CLAUDE.md`](./CLAUDE.md).

**La 1.0.0 è il giorno in cui Fabula viene consegnata davvero ai soci.** Da lì
si misura quanto manca: oggi manca l'allineamento visivo a Material Matters, e
la prova su iPhone e Android veri di quello che la 0.7.0 ha aggiunto.

---

## 0.9.1 — 29 agosto 2026

**Il Centro era una tassonomia, non un elenco di cose da fare.** Quattro
sezioni — da approvare, messaggi, oggi e domani, in ritardo — con quattro
pastiglie in cima per filtrarle. In una giornata tranquilla il risultato era
quattro intestazioni e tre righe che dicono «niente» per mostrare **un**
oggetto: metà schermo speso per dire che non c'è nulla da fare. E una
richiesta in ritardo che aveva anche un messaggio non letto compariva **due
volte**, in due sezioni, come se fossero due cose da fare invece di una da
aprire.

Fonderle tutte in una lista sola sarebbe stato sbagliato allo stesso modo,
perché **una delle quattro non è una coda**. Da approvare, messaggi e ritardi
aspettano una decisione e si svuotano; «oggi e domani» no — è l'agenda del
magazzino, si legge, e un ritiro di domani non aspetta niente da te adesso.
Metterlo in una lista che stai cercando di finire vuol dire metterci dentro
una riga che non si può finire.

Quindi **una coda in cima e l'agenda sotto**, senza pastiglie. Una riga per
**richiesta** e non per motivo: i motivi diventano marcatori sulla riga, e
quella richiesta in ritardo con un messaggio adesso è una riga sola con due
marcatori. Il ritardo è l'unico pieno — è l'unica cosa lì dentro che è già
andata storta, e un lavoro normale che grida quanto un problema toglie forza
al problema. A destra dei marcatori c'è **una** data e non tre, scelta dal
motivo più urgente: tre indicazioni di tempo sulla stessa riga non si
leggono, si scavalcano.

L'agenda compare solo se ha qualcosa: «niente da consegnare né da ricevere» è
una riga che nessuno ha chiesto, e l'assenza di consegne oggi si vede
benissimo dal fatto che non ce ne sono.

Il numero sulla pastiglia dell'intestazione non cambia significato — conta la
coda, che è esattamente ciò che contava prima. `/admin/requests` e
`/admin/overdue` continuano a rimandare qui; il `?vista=` che mostrava una
sezione sola non ha più niente da filtrare.

---

## 0.9.0 — 29 agosto 2026

**Il tema si sceglie.** Dal profilo, sotto *Aspetto*: chiaro, scuro o
automatico. Fino a ieri decideva solo il sistema operativo, il che va bene
finché le due risposte coincidono — ma un magazzino con la luce al neon si
legge meglio in chiaro anche se il telefono è in scuro dalle sette di sera, e
non c'era modo di dirlo.

È una preferenza del **dispositivo** e non della persona: solo cookie, nessuna
colonna nuova, nessuna migrazione. La lingua sta sul profilo perché ha un
consumatore lato server — le email si scrivono nella lingua di chi le riceve,
anche quando quella persona non è davanti allo schermo — mentre il tema non lo
legge nessuno tranne il browser che sta disegnando la pagina in quel momento.
E volere Fabula scura sul telefono e chiara sul portatile non è un capriccio:
è il caso normale.

Il cookie si legge **nel loader di `root.tsx`**, non nel browser, e diventa
`data-theme` sull'`<html>` che parte: non esiste nessun istante in cui la
pagina sia del colore sbagliato. Con la scelta in `localStorage` e uno script
che la applica, chi apre Fabula al buio si prende un lampo bianco in faccia a
ogni caricamento. Per la stessa ragione il colore della barra di sistema
smette di essere due righe con la media query quando la scelta è stata fatta:
chi tiene il telefono in chiaro e Fabula in scuro si sarebbe ritrovato la
barra bianca sopra a una pagina nera.

Sotto, i colori hanno smesso di essere due elenchi identici a ottanta righe di
distanza: **ogni token dichiara adesso le due tinte sulla stessa riga**, con
`light-dark()`. Da lì veniva la regola «ogni colore va definito anche fuori dal
blocco del tema scuro, o sparisce nel tema chiaro» — una regola che esiste per
ricordarsi di scrivere due volte la stessa cosa è il sintomo, non la cura, e i
rapporti di contrasto stavano annotati accanto a un valore e andavano
ricalcolati accanto all'altro, che nessuno vedeva. Adesso li vede tutti e due.
Il prezzo è dichiarato in `app.css`: `light-dark()` chiede Safari 17.5 e
Chrome 123, metà 2024, poco sopra al gradino che Tailwind 4 già impone.

**Rifinitura d'insieme, telefono e scrivania.** Niente di nuovo da usare: le
stesse schermate, guardate una accanto all'altra invece che una alla volta.
Da lì è venuto fuori che tre cose avevano smesso di avere un posto solo,
esattamente come era successo ai pulsanti prima della 0.5, e che quattro
difetti si vedevano solo col dito o solo da tastiera.

**La scala dei corpi era diventata dieci misure a occhio.** `text-[0.6rem]`,
`0.62`, `0.65`, `0.66`, `0.68`, `0.7`, `0.8`, `0.82`, `0.9`, `0.95`: 108
volte in venti file, nessuna scelta, tutte cresciute ritoccando la schermata
del momento. Si vedeva mettendo due pagine vicine — la stessa etichetta in
maiuscoletto era 9,6px sul calendario, 10,4px nell'intestazione, 10,9px sul
catalogo. Ora sono due passi in più a quelli di Tailwind (`text-2xs` 11px,
`text-md` 15px) e nient'altro, **con 11px come pavimento**: sotto, un
maiuscoletto spaziato smette di leggersi a braccio teso, che è la distanza a
cui si guarda un telefono in magazzino. Le tre misure che ci stavano sotto
erano tutte etichette che portano informazione — la categoria di un oggetto,
chi ha in mano cosa, il conteggio del Centro.

Insieme sono nate due utility in `app.css`: `eyebrow`, l'etichetta in
maiuscoletto scritta a mano 64 volte, e `field`, il tessuto di un campo che
diciotto input su settanta si riscrivevano da soli — tre dei quali sbagliando
l'altezza, 38px invece di 44.

**Otto voci di menu non sono una barra, sono un elenco.** Con un admin
l'intestazione arrivava a **269px su uno schermo da 375: un terzo dello
schermo prima di vedere un oggetto**, su quattro righe. Le otto voci però non
pesano uguale, e la gerarchia era già scritta nel prodotto: il Centro è il
lavoro di un turno, soci-oggetti-scanner-registro sono amministrazione. Il
Centro resta in vista con la sua pastiglia, gli altri quattro entrano in un
menu «Gestione» — a ogni misura di schermo, perché anche sul desktop otto
collegamenti in fila si leggevano come otto posti da controllare, che è il
difetto che il Centro esiste per togliere. Sotto ai 640px sparisce anche il
proprio nome accanto all'avatar. **169px, due righe.**

**Le finestre di conferma erano del sistema operativo.** Otto
`window.confirm()`, e per Fabula sono un corpo estraneo in tre modi: i due
pulsanti non sono tradotti (un socio con Fabula in tedesco vedeva la domanda
in tedesco e «OK/Annulla» nella lingua del sistema), «OK» non dice mai cosa
sta per succedere, e il processo si blocca. Adesso sono un dialogo nostro —
stesso guscio del foglio della richiesta, ora estratto in
`components/dialog.tsx` — con il **verbo dell'azione** sul pulsante di
conferma e la sesta variante di `Button`, `destructive`: dentro a una
conferma il pulsante che distrugge è l'azione principale di quel dialogo, e
con la fattura del `danger` quieto restava meno vistoso di «Annulla». Ne è
sparito anche uno **doppio** — due finestre di sistema in fila prima di
mandare un link di reimpostazione password: due domande consecutive non fanno
leggere di più, fanno premere «OK» due volte senza guardare. Sono diventate
una domanda con sotto la conseguenza.

**Un pulsante spento non è un'attesa.** L'unico segnale che qualcosa stesse
viaggiando era il pulsante che si disabilitava — che vuol dire anche «non si
può premere», cioè il contrario, e non dice che finirà. `Button` ha ora uno
stato `busy` con cerchietto e `aria-busy`, ed è l'unica animazione
dell'applicazione. Sotto `prefers-reduced-motion` rallenta invece di
fermarsi: un indicatore immobile dice «si è bloccato», che è peggio di dove
si era partiti.

**Il calendario, tre difetti.** Le intestazioni dei giorni non erano
appiccicate: dopo sei oggetti le date erano uscite dallo schermo e restavano
barre colorate senza sapere di che giorno fossero — ora il riquadro scorre da
sé nei due versi e mesi e giorni restano in cima. Le barre erano velature
all'1,15:1 sul fondo della scheda, cioè invisibili da lontano proprio dove la
barra **è** il dato: un contorno di un pixel nella tinta piena, come già
aveva `REQUESTED` tratteggiato. E l'etichetta si troncava in «RESER…» su ogni
prenotazione corta — un troncamento che non lascia leggere niente non è un
ripiego, è rumore: ora si accorcia a gradini e sotto ai tre giorni sparisce,
con il nome per esteso sempre disponibile a un lettore di schermo e non solo
al passaggio del mouse, che sul telefono non esiste.

**Il resto, piccolo ma vero.** Nel Centro un messaggio non letto adesso dice
**quando** — il dato arrivava già dal loader e finiva nel nulla, e uno di
dieci minuti fa e uno di quattro giorni fa erano la stessa riga. Nella scheda
di un kit i pezzi sbarrati dicono perché lo sono, invece di lasciare che un
kit da quattro aggiunga tre oggetti senza spiegarsi. Sul catalogo l'anello di
fuoco stava intorno al titolo e non intorno alla scheda, che è ciò che si
apre. E quattro pulsanti si erano riscritti a mano invece di passare da
`Button`.

---

## 0.8.0 — 28 agosto 2026

**Il calendario personale, uno per persona e non uno per tutti.**
`/calendar.ics` era uno solo, pubblico, con **tutti** i prestiti
dell'associazione insieme: chi lo aggiungeva a Google Calendar si ritrovava
l'agenda di chiunque e non trovava da nessuna parte i propri. Dal profilo,
ora, un collegamento — `/cal/<token>.ics` — mostra solo i propri: approvati e
in attesa, questi ultimi provvisori (`STATUS:TENTATIVE`), con dove ritirare e
riportare ogni oggetto e un avviso il giorno prima della scadenza. Un evento
per oggetto e non per richiesta, perché una richiesta con pezzi in due
magazzini avrebbe portato una sola posizione che ne avrebbe smentita metà. Il
collegamento **è una credenziale** e non un id — chi ce l'ha vede quei
prestiti senza fare l'accesso — quindi `Cache-Control: private, no-store`,
mai indicizzato, 404 muto per un token sbagliato, e un pulsante nel profilo
che lo rigenera invalidando il vecchio nello stesso istante. **Il vecchio
`/calendar.ics` pubblico è stato tolto**, non lasciato accanto al nuovo:
l'obiettivo non era aggiungere un secondo calendario, era che ognuno avesse
il proprio invece di doversi cercare in mezzo a quello di tutti.

---

## 0.7.0 — 28 agosto 2026

Il ciclo del prestito funzionava già da capo a fondo. Quello che mancava era
**il contorno che lo rende usabile da volontari che si alternano**: accorgersi
di una richiesta senza avere tre posti da guardare, ricevere un promemoria
prima e non dopo, e non dover tenere aperta la casella di posta per sapere
cosa succede. Due filoni di lavoro, portati avanti in parallelo.

### La piattaforma si fa capire

- **Il modulo della richiesta chiede quello che serve sapere.** Il campo «a
  cosa serve» esisteva solo dentro alla spunta dei sette giorni: chi ne
  chiedeva tre non aveva nessun posto dove scrivere «mi serve anche il
  carrello» o «passo a ritirarlo di sabato». L'unico canale era la chat, che
  però nasce dopo l'invio, quando l'admin ha già letto una richiesta nuda. Ora
  il campo c'è sempre ed è la spunta a renderlo obbligatorio, non a farlo
  esistere. Corretti due difetti che si vedevano solo aprendo «Modifica date»
  su una richiesta che ne aveva già: il campo partiva vuoto e salvare
  cancellava in silenzio quello che era scritto, e la spunta partiva spenta,
  quindi una richiesta speciale già approvata veniva rifiutata senza che
  nessuno avesse toccato le date. Nell'accesso, il codice via email dice
  quanto può metterci ad arrivare e il reinvio resta spento 45 secondi: Better
  Auth ne concede tre al minuto, e chi non lo vedeva arrivare si bloccava da
  solo premendo «Mandane un altro».
- **Lo stato di un oggetto si vede da lontano.** Su una griglia di venti
  schede le tre pastiglie avevano lo stesso peso visivo e si distinguevano
  solo leggendole una per una. Ora il badge ha un tono pieno per il catalogo e
  uno velato per gli elenchi fitti dell'admin, ogni stato porta una forma
  (● pieno, ▪ bloccato, ◇ fuori gioco) che vale anche senza colore — circa un
  uomo su dodici non distingue verde e rosso, e su un elenco stampato non li
  distingue nessuno — e la scheda porta una fascia di stato in cima. I token
  nuovi sono propri degli stati e non toccano `--accent`, che è la porta da
  cui il rosso di Material Matters entrerà al rebrand.
- **Il Centro.** Erano tre posti da guardare e nessuno che li riassumesse:
  coda di approvazione, ritardi, e la chat, che non aveva nessuna superficie
  propria. Aprendo il Centro la prima volta sono saltati fuori tre messaggi di
  soci veri a cui non aveva risposto nessuno. Le sezioni sono in ordine di chi
  sta aspettando te, non di gravità, con una sola eccezione dichiarata: un
  ritardo oltre la settimana sale in cima. `/admin/requests` e
  `/admin/overdue` restano e rimandano lì. Lo stesso meccanismo dà finalmente
  a chi chiede in prestito il segnale che gli è sempre mancato: «ti hanno
  risposto».
- **La chat si aggiorna da sola.** Ci si accorda su un ritiro dentro alla
  chat, ma la pagina mostrava la conversazione di quando l'avevi aperta: chi
  la guardava credeva di essere aggiornato, che è peggio di non mostrarla.
  Server-Sent Events, nessuna dipendenza nuova, e una regola che rende la cosa
  difendibile: sul canale non passa mai un contenuto, solo un colpetto, e il
  browser ricarica il loader che esisteva già con le sue autorizzazioni.
- **I promemoria diventano quattro, e sanno dire dove.** Da uno solo (il
  giorno prima della riconsegna) a ritiro, scadenza vicina, scadenza oggi e
  ritardo a 1, 3 e 7 giorni, più un riassunto unico al giorno agli admin.
  Tutti raggruppano gli oggetti per posizione: una richiesta con pezzi in due
  magazzini, riassunta in un indirizzo solo, manda qualcuno a cercare una cosa
  dove non c'è. **E si spedisce solo fra le 8 e le 20 ora di Roma**: il giro
  ragiona in giorni UTC e partiva all'una di notte — con le notifiche push
  sarebbe stata una suoneria alle 2, cioè il modo più rapido per farle
  spegnere a tutti. `Request.reminderSentAt` lascia il posto a `ReminderLog`,
  perché un timestamp solo sapeva dire *se* era partito qualcosa, non *quale*
  dei quattro.

### Fabula si installa, e gli avvisi scelgono la strada

- **Il guscio.** Manifesto, service worker, pagina di cortesia senza rete
  nelle tre lingue, e le icone generate da `pnpm icons` a partire dalla **F**
  del lettering — il logo intero è largo 3,86:1 e dentro a un quadrato da 48
  pixel non si legge. Il lettering vero entra nell'intestazione al posto della
  scritta col punto. Si ottengono icona sulla schermata Home, finestra senza
  barra del browser, e il pallino col numero sull'icona — lo stesso numero che
  mostra il Centro, perché due conti diversi per la stessa cosa si
  contraddicono a vicenda.
- **La cache del service worker è una regola di sicurezza, non una scelta di
  velocità.** Non finisce in cache nessuna pagina e nessuna risposta di
  loader: solo `/assets/*`, che Vite firma con l'impronta del contenuto nel
  nome. Una pagina di Fabula contiene ubicazioni, note interne degli admin e i
  nomi di chi ha in prestito cosa — metterla in cache vuol dire lasciarla sul
  disco del telefono, leggibile dopo l'uscita e dopo che a quella persona è
  stato tolto il ruolo di admin. Sarebbe la regola «niente dati riservati nei
  loader pubblici» aggirata dal basso, dal browser stesso. Il prezzo è che
  senza rete si vede una pagina di cortesia e non il catalogo: è il prezzo
  giusto.
- **Ogni persona sceglie il canale** dal proprio profilo: email, notifiche
  dell'app, o entrambe, con l'elenco dei dispositivi iscritti e una notifica
  di prova — che vale da sola metà della verifica, perché senza bisognerebbe
  aspettare che qualcuno faccia una richiesta per sapere se funziona.
  Un'iscrizione è del **dispositivo** e la preferenza è della **persona**:
  telefono e portatile sono due righe, e chi non lo capisce accende le
  notifiche sul portatile ed esce dall'ufficio.
- **Il confine che non si sposta:** la preferenza vale solo per gli avvisi di
  prestito. Codice di accesso, reimpostazione della password e comunicazioni
  sulla piattaforma restano email per chiunque. Una notifica che non arriva è
  un fastidio; un codice di accesso che non arriva chiude fuori una persona.
  Allo stesso modo, nel corpo di una notifica non vanno nomi di persona,
  luoghi né nomi di oggetti: si legge a schermo bloccato, in mezzo alla gente.
- **Tre difese contro il modo in cui le notifiche falliscono, cioè in
  silenzio.** Chi ha scelto solo le notifiche ma non ha nessun dispositivo
  vivo riceve comunque l'email; le iscrizioni morte si cancellano da sole sul
  404 o 410 del servizio push, e solo su quelli, o un guasto temporaneo di
  Google disiscriverebbe tutti; il promemoria a mano dice se non è partito
  invece di dire «fatto».
- **I destinatari degli avvisi admin arrivano dal database** e non più da
  `ADMIN_EMAILS`, che resta per chi non ha un account. Gli indirizzi di quella
  lista che coincidono con un admin registrato vengono scartati: altrimenti
  chi ha scelto «solo notifiche» continuerebbe a ricevere la posta dalla porta
  di servizio, che è esattamente il problema da risolvere.

### Da sapere

- **Le chiavi VAPID (`.env`) sono un segreto con memoria.** Rigenerarle non
  rompe niente in modo visibile: semplicemente ogni iscrizione push diventa
  carta straccia e tutti i telefoni smettono di ricevere nello stesso istante,
  senza che nessuno lo sappia. Vanno copiate in un gestore di password accanto
  a `SESSION_SECRET`. Il backup non le salva, e non le salverà: il `.env`
  contiene anche la password del database e le chiavi di Resend e Google.
- **In sviluppo non si tiene una chiave Resend viva**, perché lo spazzatore
  dei promemoria gira anche lì e il seed ha scadenze vere. Vedi *Trappole già
  incontrate* in `CLAUDE.md`.
- **Resta da provare su dispositivi veri**, dal tunnel `try.fabulabz.com`. Su
  iPhone le notifiche funzionano **solo** dopo «Aggiungi alla schermata Home»:
  è un vincolo di Apple, e per gli admin con iPhone l'installazione non è
  un'opzione ma il prerequisito.

---

## 0.6.0 — 27 agosto 2026

Fabula lascia il MacBook. Il rischio non è mai stato il carico ma la
**disponibilità**: un portatile che va in sospensione è la piattaforma
offline, e il tunnel non può farci niente. Da qui in poi gira su un server
Linux con Coolify, e **aggiornare è `git push`**.

### Aggiunto

- **Le migrazioni si applicano da sole all'avvio** (`docker-entrypoint.sh`).
  Prima non le applicava *nessuno*: il `Dockerfile` finiva con
  `react-router-serve` e basta, e funzionava solo perché il rilascio era un
  gesto umano con le migrazioni come gesto umano accanto. Col rilascio al
  push quel secondo gesto non c'è più, e il primo commit che tocca lo schema
  avrebbe mandato online il codice nuovo contro il database vecchio. Se
  `migrate deploy` fallisce il container esce prima di servire, e Coolify
  tiene su la versione precedente: un database a metà strada è peggio di un
  rilascio che non parte.
- **`/healthz`**, che interroga davvero il database con una `SELECT 1`. La
  distinzione che conta non è «il processo è vivo» ma «la piattaforma è
  viva»: un Node in piedi con Postgres irraggiungibile, per chi usa Fabula, è
  indistinguibile da tutto spento — e un controllo sulla sola porta 3000 non
  lo vedrebbe.
- **[`docs/coolify.md`](./docs/coolify.md)**: server, risorse, migrazione dei
  dati e cosa succede a ogni push, col perché accanto a ogni scelta.

### Cambiato

- **`dotenv` passa alle dipendenze di produzione** e `prisma.config.ts` entra
  nell'immagine finale. Non è pulizia: dal Prisma 7 l'URL del database non sta
  più nel blocco `datasource` dello schema ma in quel file, quindi senza di
  lui `migrate deploy` non sa nemmeno a quale database parlare.
- **La riga di versione sopravvive al clone di Coolify.** `versionStamp`
  conta i commit, ma Coolify clona in profondità 1: il conteggio avrebbe
  detto `1` **senza fallire**, quindi in silenzio e per sempre. Ora, quando
  c'è, vince lo sha passato come `SOURCE_COMMIT`.
- **La trappola dell'`APP_PORT` sparisce in produzione.** `cloudflared` sta
  nella stessa rete Docker e punta al container per nome: nessuna porta
  esposta sull'host, e non più due numeri in due pannelli diversi che nulla
  teneva allineati. Resta vera per chi rialza tutto col
  `docker-compose.yml` — che **rimane, e va tenuto funzionante**: è la via di
  fuga se un giorno Coolify è il problema.

---

## 0.5.1 — 24 agosto 2026

### Cambiato

- **La foto del profilo si cambia premendo la foto.** Accanto all'avatar
  c'era un `<input type="file"` nudo: l'unica cosa premibile era il «Scegli
  file» disegnato dal browser, testo grigio piccolo di un altro mondo
  rispetto al resto dell'interfaccia — mentre la foto, che è ciò che tutti
  provano a premere, era un'immagine morta. Ora il cerchio è il bersaglio,
  con un bollino della fotocamera **sempre visibile** (sul telefono il
  passaggio del mouse non esiste, e un invito che compare solo col mouse è di
  nuovo un invito invisibile), il velo con la scritta per chi il mouse ce
  l'ha, e accanto un pulsante vero — preso da `components/button.tsx` come
  tutti gli altri. Senza foto il cerchio è tratteggiato e il pulsante dice
  «Aggiungi una foto».
- **La foto scelta si vede subito**, prima ancora che parta: l'anteprima
  locale sta al posto dell'avatar e il caricamento si annuncia sul cerchio,
  non in una riga di testo lontana dall'elemento che cambia.
- **Misura e formato si controllano prima di spedire.** Un JPEG da 12 MB non
  sale più per intero solo per farsi rifiutare in fondo: da un telefono in 3G
  era la differenza fra un secondo e un minuto buttato. I due limiti stavano
  scritti in due posti con un commento che chiedeva di tenerli allineati a
  mano; ora sono uno solo, `app/lib/uploads.shared.ts`, letto dal server,
  dalle foto degli oggetti e da quella del profilo.

---

## 0.5.0 — 24 agosto 2026

La prima versione numerata. Non è un rilascio: è la fotografia di dove siamo
arrivati in ventotto commit, scritta adesso perché da qui in poi ogni passo
abbia un prima e un dopo.

**Il ciclo intero funziona da capo a fondo — dal catalogo alla riconsegna —
verificato dal vivo e non solo compilato.**

### Aggiunto

- **Catalogo pubblico** senza account, con ricerca, kit che si sciolgono nei
  loro pezzi dentro al carrello, e un badge che risponde a una domanda sola:
  *lo prendo adesso?*
- **Richieste**: le date si scelgono al momento di chiedere, non in cima al
  catalogo. Fino a sette giorni senza altro; oltre, la spunta «richiesta
  speciale» chiede un motivo.
- **Dettaglio di una richiesta**, due pubblici sullo stesso indirizzo: chi ha
  chiesto modifica le date, annulla e scrive in chat; l'admin approva,
  rifiuta, segna ritiro e riconsegna **per singolo oggetto** — così una
  riconsegna parziale libera subito i pezzi tornati.
- **Coda di approvazione** e **pannello admin** completo: oggetti, categorie,
  kit, soci, con ricerca, filtri e spostamento in blocco.
- **Registro delle azioni admin**, in sola lettura: gli admin sono volontari
  che si alternano, e «chi ha segnato questo ritiro?» era una domanda senza
  risposta.
- **Storico dei prestiti** nella scheda admin di un oggetto, subito sopra al
  pulsante di archiviazione — che è il momento in cui la domanda «vale lo
  spazio che occupa?» si fa davvero.
- **QR per oggetto, scanner e consegna diretta**: si inquadra l'adesivo, si
  sceglie a chi darlo e fino a quando. Quello che nasce è una richiesta
  normale, già approvata e già ritirata: nessuna tabella nuova, e chat,
  riconsegna e promemoria funzionano subito.
- **Promemoria di riconsegna automatico**, con uno spazzatore orario in
  processo e una guardia sul giorno già fatto.
- **Accesso** con codice via email (principale), password, Google e
  l'account dell'università via Microsoft.
- **Calendario** a righe-oggetto per colonne-giorno, con esportazione iCal
  pubblica; sotto i 640px diventa un elenco invece di una timeline.
- **Profilo personale** con foto, nome, cognome e alias — ed è l'alias che si
  vede ovunque nell'interfaccia.
- **Tre lingue** tipizzate: inglese, italiano e tedesco. Se una chiave manca,
  `pnpm typecheck` fallisce.
- **Backup verso OneDrive** (`scripts/backup.sh`): dump datato del database e
  cartella foto. Le foto si copiano e non si sincronizzano mai, così una
  cancellazione locale per sbaglio non si propaga al backup.

### Sicurezza

- Ogni azione che scrive comincia con `requireUser` o `requireAdmin`, e
  `requireAdmin` risponde **404 e non 403**: a chi non è admin il pannello non
  risulta nemmeno esistere.
- Limite di frequenza sull'accesso, con l'IP vero letto da dietro il tunnel
  Cloudflare — senza, il limite sarebbe stato di tre codici al minuto per
  l'intera associazione.
- Intestazioni di sicurezza su ogni pagina, `SESSION_SECRET` obbligatoria in
  produzione, Postgres esposto solo su `127.0.0.1`.
- Il testo letto da un QR è trattato come dato e mai come indirizzo: un
  adesivo è un oggetto fisico che chiunque può sostituire.
- `.env` escluso dal contesto di costruzione: non arrivava nell'immagine
  finale, ma finiva negli strati intermedi, che restano nella cache del daemon.

### Corretto

- Il badge di un oggetto **prenotato per la settimana prossima** era dello
  stesso arancione di uno già in uso, e la gente passava oltre credendolo
  occupato.
- `Permissions-Policy: camera=()` spegneva la fotocamera **anche a noi**: lo
  scanner non chiedeva mai il permesso, e concederlo a mano non cambiava
  niente perché la decisione era già presa dall'intestazione.
- Lo scanner nascosto con `display: none` non disegnava fotogrammi e leggeva
  nero, su computer e telefono insieme.
- `state_mismatch` all'accesso con Google, causato da due scadenze diverse.
- Bersagli di tocco portati a 44px e menu lingua raccolto in un pulsante:
  l'associazione consegna gli oggetti di persona, quindi la piattaforma si usa
  in magazzino col telefono in mano.
- Ricostruzione del container da **48 secondi a 4**, riordinando il
  `Dockerfile` perché i manifesti vengano copiati prima del sorgente.
