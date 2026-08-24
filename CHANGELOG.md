# Cosa è cambiato

Qui si legge come cresce Fabula. Le voci dicono **perché**, non solo cosa: il
codice racconta già com'è fatto, e la domanda che arriva dopo è sempre l'altra.

Il numero di versione è un giudizio, deciso a mano quando un pezzo di lavoro
finisce — non sale da solo. Il suo significato, e il rito che tiene insieme
piani, changelog e versione, stanno nel capitolo *Versione* di
[`CLAUDE.md`](./CLAUDE.md).

**La 1.0.0 è il giorno in cui Fabula viene consegnata davvero ai soci.** Da lì
si misura quanto manca: oggi mancano l'allineamento visivo a Material Matters
e la PWA con le notifiche.

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
