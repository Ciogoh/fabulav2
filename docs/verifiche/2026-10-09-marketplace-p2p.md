# Verifica locale del marketplace P2P

Verifica eseguita l'8–9 ottobre 2026 su localhost, con PostgreSQL locale e
cinque account dedicati: prestatore A, prestatore B, richiedente, admin con
email amministrative attive e admin con email amministrative disattivate.
Backup prima delle migrazioni; nessun reset del database. Email reali
disattivate nel processo di prova, trasporto console; push già disattivate.

Le prove HTTP chiamano le route vere, usando sessioni create da Better Auth.
Le asserzioni sul database verificano l'esito delle transazioni. Gli script
temporanei e i dati sintetici vengono rimossi dopo la verifica; Vitest resta
limitato alla logica pura, come richiesto da CLAUDE.md.

| Prova | Esito osservato |
| --- | --- |
| Bozza con foto JPEG derivata da PNG | Testo e foto salvati; HTML e `.data` privati `no-store` |
| Foto/proposta da anonimo o altro socio | Foto 404; proposta non leggibile; admin senza email conserva accesso |
| Upload invalido durante invio | Testo recuperabile in bozza, nessuna pubblicazione o proposta inviata |
| Revisione | Chat, rifiuto motivato, correzione, reinvio e pubblicazione funzionano |
| Decisione con versione vecchia | Rifiutata; lo stato più recente rimane intatto |
| Lettura di un nuovo messaggio di revisione | Aggiorna solo il segnalibro, senza invalidare la revisione dei contenuti |
| Errore su una modifica in concorrenza | Nome e descrizione digitati restano nel modulo; nessuna sovrascrittura |
| Scheda pubblica, con e senza sessione | Nessun ID/nome/email del proprietario; nessuna location o nota interna |
| Carrello MM + A + B, duplicato incluso | Un lotto, tre richieste, quattro pezzi distinti; responsabilità per gruppo |
| Pezzo in bozza, pausa, auto-prestito | Invio rifiutato senza lotto o richieste parziali |
| Due invii concorrenti con la stessa chiave | Stesso lotto e stessi ID; un solo insieme di pratiche |
| Retry e chiave con contenuto diverso | Retry recuperato; contenuto diverso rifiutato |
| Conflitto nato dopo il riepilogo | Errore visibile nella UI, carrello conservato; riapertura conserva la chiave del tentativo |
| Due approvazioni sovrapposte | Una sola richiesta approvata per gli stessi pezzi e date |
| Due consegne dirette concorrenti | Una sola prenotazione approvata; prestatore e pickup conservati |
| Permessi delle pratiche | Prestatore A non legge pratica B o il lotto; SSE non autorizzate 404 |
| Note interne | Assenti da HTML del richiedente/prestatore; tentativo di scrittura del socio 404 |
| Pickup e restituzione parziale | Si libera solo il pezzo restituito; modifica/cancellazione dopo pickup bloccate |
| Ritiro/archiviazione ordinaria con pratiche aperte | Bloccati anche lato server; collegamenti alle pratiche da chiudere |
| Storico e cancellazione | Proposta senza storico eliminabile; oggetto con prestiti conservato |
| Intervento admin | Correzione registrata; archiviazione eccezionale e ripristino funzionano |
| Prestito approvato con tutti i pezzi archiviati | Conservato nello storico, escluso dalla coda operativa; nessun comando di consegna visibile |
| Conversazione di revisione | Guardiano d'invio presente per admin selezionato, assente per admin spento e altro prestatore |
| Conversazione P2P | Un solo destinatario pertinente; messaggi ravvicinati non duplicano il guardiano |
| Admin prestatore con switch email spento | Riceve avvisi personali; digest personale registrato una sola volta |
| Admin richiedente | Non approva la propria richiesta; lettura usa il segnalibro personale |
| SQL dei non letti | Nessun messaggio proprio segnalato come nuovo; vista operativa e personale separate |
| SSE del lotto | Connessione privata riceve davvero `change` dopo un messaggio di una sua pratica |
| Regressione istituzionale | Richiesta approvata, calendario pubblico e pannello Soci funzionano; nessun kit misto preesistente |
| Kit con un ID personale inviato a mano | Rifiutato senza creare un kit vuoto |
| QR e iCal | QR maiuscolo mantiene i redirect corretti; bozza 404; feed personale non include i prestiti del proprietario ad altri |

## Verifica nel browser

Nel browser in-app sono stati eseguiti accesso con password, creazione di una
bozza, invio, revisione admin con conferma, pubblicazione, carrello misto e
invio delle tre pratiche. La pagina di successo presenta decisioni e
collegamenti separati. Sono stati provati logout, pausa/ripresa con switch e
azioni disabilitate in presenza di prestiti aperti.

Viewport verificati tramite la larghezza effettiva del documento: 360, 390,
768 e 1280 px, senza scorrimento orizzontale nelle schermate campionate, inclusi un nome senza spazi di 113 caratteri e
una descrizione di 3.000 caratteri.
Controllati Classico e Riso in chiaro/scuro e contenuti en/it/de. Lo switch
misura 44 px; la conferma riceve il focus su Annulla, il dialogo delle date
nel primo campo visibile. Sul telefono Presta è nel menu profilo e non
aggiunge una riga isolata di controlli.

Correzioni trovate da queste prove: gruppi del carrello compressi dal layout
flex, focus sul primo input nascosto, etichetta «Apri oggetto» su un prestito,
messaggi propri contati nella vista admin e segnalibro della proposta che
alterava `updatedAt`. Le prove pertinenti sono state ripetute dopo le correzioni.

Screenshot salvati negli artefatti della sessione Codex: carrello desktop,
riepilogo mobile in tedesco, conflitto di disponibilità e switch in Riso.
Le immagini contengono soltanto dati sintetici di prova.

Il selettore nativo dei file del browser in-app non è controllabile da questa
sessione: caricamento valido/invalido e accesso alle foto sono verificati con
multipart HTTP e risposte del server, non con una scelta nel dialogo nativo.
Questa verifica responsive usa viewport reali del browser desktop; non è una
prova su iPhone o Android fisici. Non è una prova di consegna Resend né di
notifica push su un dispositivo reale.

## Controlli ripetibili

`pnpm typecheck`, `pnpm test` (57 test in 7 file) e `pnpm build`. Controllo
delle migrazioni applicate e `git diff --check`. La pulizia finale elimina
solo gli account e le righe creati per queste prove, preservando il catalogo
e lo storico locale preesistente.

Pulizia completata: rimossi cinque account, otto oggetti e undici richieste
sintetiche, insieme a foto, messaggi, sessioni e guardiani correlati.
Le asserzioni finali confermano che i tre utenti, ventuno oggetti e quattro
richieste preesistenti rimangono nel database. Rimossi anche i dieci script
temporanei e i file delle sessioni di prova; mantenuto il backup locale.
