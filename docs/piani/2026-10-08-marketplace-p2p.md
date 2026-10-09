# Prestare gli oggetti dei soci in Fabula

**Attuato in 0.12.0 il 9 ottobre 2026.** Le fasi 0–5 sono implementate e
verificate in locale. [Guida](../marketplace-p2p.md) e
[prove osservate e limiti](../verifiche/2026-10-09-marketplace-p2p.md).
L'esito locale non comprende una distribuzione in produzione.

**Data:** 8 ottobre 2026 · **Stato:** pianificato, da sviluppare.

Questo piano sviluppa [P2P_MARKETPLACE_PLAN.md](../../P2P_MARKETPLACE_PLAN.md) e segue [CLAUDE.md](../../CLAUDE.md). Le decisioni qui sotto costituiscono la proposta operativa per la prima versione: percorsi, permessi, dati, interfaccia, ordine di sviluppo e criteri di completamento. La verifica iniziale riguarda il codice e lo stato delle migrazioni locali; non certifica il funzionamento delle parti P2P già abbozzate.

## 1. Il risultato da ottenere

Un socio mette a disposizione un oggetto, gli admin ne verificano la scheda e lo pubblicano. Un altro socio lo trova nello stesso catalogo degli oggetti di Material Matters e ne richiede il prestito. Il proprietario decide, concorda il ritiro nella chat e registra consegna e restituzione. Gli admin conservano la possibilità di intervenire.

L'interfaccia deve spiegare tre cose senza richiedere di conoscere il modello dati: **se un oggetto è pubblicato, chi deve rispondere a una richiesta e quale azione aspetta l'utente**. Pubblicazione, disponibilità e andamento del prestito sono tre informazioni diverse.

La prima versione comprende proposta, bozza, revisione, gestione degli oggetti propri, carrello con più proprietari, richieste separate, chat e notifiche pertinenti. Pagamenti, cauzioni, recensioni, profili pubblici, geolocalizzazione e trasferimento di proprietà restano sviluppi successivi. I kit rimangono composti da oggetti di Material Matters; continuano a espandersi in singoli pezzi nel carrello.

## 2. Da dove partiamo davvero

| Area | Evidenza nel codice locale | Lavoro necessario |
| --- | --- | --- |
| Schema | `AssetStatus`, `Asset.ownerId` e `AssetMessage` esistono. `prisma migrate status` riporta il database locale aggiornato, inclusa la migrazione P2P. | Collegare anche le richieste al responsabile del prestito e rendere sicuri ciclo di vita e cancellazioni. |
| Proposta | `/presta` crea un oggetto `PENDING`, riutilizzando campi e foto. | Il redirect `/account/items` non ha ancora una rotta; mancano bozza, gestione, traduzioni complete e feedback sugli upload falliti. |
| Catalogo | Catalogo e dettaglio filtrano gli oggetti approvati e mostrano il proprietario. | Togliere i nomi dalle risposte pubbliche; estendere il filtro di pubblicazione alle altre superfici. |
| Carrello | `app/components/cart-bar.tsx` invia all'action di `app/routes/requests.tsx`. | Oggi nasce una sola richiesta e il successo contiene un solo `id`. Non esiste `app/routes/cart.tsx`. |
| Prestiti | Il dettaglio autorizza richiedente e admin; pickup e restituzione sono già sui singoli `RequestItem`. | Autorizzare il proprietario della pratica, senza trasformarlo in admin. |
| Chat e inbox | `Message` serve i prestiti; gli indicatori non letti distinguono gli autori tramite il ruolo admin. | Distinguere i partecipanti per identità: un prestatore può essere un socio, un richiedente può essere admin. |
| Email admin | Esiste la selezione degli admin destinatari, indipendente dai loro permessi. | Mantenerla per le comunicazioni amministrative e aggiungere destinatari P2P mirati. |

Le modifiche P2P presenti nella working directory sono una base da completare. Non vanno sostituite indiscriminatamente, né considerate già pronte per il rilascio.

### Correzioni da fare prima dei nuovi flussi

- **Identità pubbliche:** il testo «Prestato da [Nome]» contrasta con la regola di CLAUDE.md «Nessun nome di persona nelle superfici pubbliche». Nel catalogo anonimo useremo «Oggetto di un socio» oppure «Material Matters». Anche il JSON del loader deve escludere nomi, alias, avatar, email e identificativi del proprietario non necessari. Le identità diventano visibili nella pratica privata ai partecipanti autorizzati.
- **Pubblicazione incompleta:** calendario, composizione dei kit, conteggi e endpoint di disponibilità devono applicare lo stesso criterio del catalogo. Una proposta non approvata non deve essere prenotabile inviando il suo ID a mano.
- **Proprietario cancellato:** `Asset.owner` usa oggi `onDelete: SetNull`. Cancellare un socio trasformerebbe implicitamente il suo oggetto in un oggetto di Material Matters. Va impedito con una relazione restrittiva e una gestione esplicita della disattivazione dell'account.
- **Categorie:** nascondere i campi admin non basta; `categoryFromForm` permette anche la creazione di categorie. Il socio sceglie una categoria esistente o lascia la classificazione agli admin; non modifica la tassonomia globale.
- **Foto:** oggi `/uploads/*` è pubblico e ha cache annuale. Una foto di una proposta è quindi accessibile a chi possiede l'URL. Occorre autorizzare le foto degli oggetti non pubblicati, incluse le miniature, e adeguare la cache: un UUID non è un controllo di accesso.

## 3. Regole di prodotto e permessi

Essere proprietario è una relazione con un oggetto e con una pratica, **non un nuovo ruolo globale**. `User.role` resta invariato. Tutti gli admin mantengono i loro permessi, anche se non ricevono email amministrative.

| Operazione | Socio proprietario | Richiedente | Admin |
| --- | --- | --- | --- |
| Proporre un oggetto | Sì, assegnato a sé dal server | Sì, per i propri oggetti | Sì; scegliere esplicitamente oggetto personale o di Material Matters |
| Leggere proposta e chat di revisione | Solo la propria | No | Tutte |
| Pubblicare o rifiutare una proposta | No | No | Sì |
| Modificare contenuti prima della revisione | Bozza; ritirare prima una proposta in revisione | No | Sì, con modifica tracciata |
| Mettere in pausa un oggetto pubblicato | Solo il proprio | No | Sì |
| Richiedere un prestito | Oggetti altrui; niente richiesta a sé stesso | Sì | Sì, con le stesse regole quando richiede per sé |
| Leggere richiesta e chat del prestito | Solo pratiche di cui è prestatore | Solo le proprie | Tutte, per assistenza |
| Approvare o rifiutare il prestito | Solo pratiche di cui è prestatore | No | Oggetti della sede; intervento P2P esplicito e tracciato |
| Registrare consegna e restituzione | Solo pezzi della propria pratica | No | Sì, con intervento tracciato se P2P |
| Leggere note interne admin | No, salvo ruolo admin | No, salvo ruolo admin | Sì |

Ogni action comincia con `requireUser` o `requireAdmin`, poi verifica il diritto sul record. I dati inviati dal browser non possono stabilire proprietario, ruolo, stato di approvazione o destinatario. Un record privato non autorizzato risponde 404; le nuove pagine admin mantengono la stessa convenzione.

La chat del prestito contiene accordi tra i partecipanti; `Request.adminNote` rimane esclusivamente amministrativa. Il prestatore non accede alla directory dei soci, alle pratiche di altri prestatori o allo storico globale. Per gli oggetti P2P, un indirizzo o luogo privato viene condiviso nella pratica autorizzata, non con ogni utente autenticato che apre il catalogo.

## 4. Due cicli di vita distinti

### Proposta dell'oggetto

| Stato | Significato visibile | Azioni principali del socio |
| --- | --- | --- |
| `DRAFT` | Bozza, visibile solo al proprietario e agli admin | Modifica, aggiungi foto, invia, elimina |
| `PENDING` | In revisione; non ancora nel catalogo | Leggi e rispondi alla chat, ritira in bozza, elimina se senza prestiti |
| `APPROVED` | Pubblicato; la prenotabilità dipende anche da `isBookable` | Apri scheda, gestisci richieste, metti in pausa |
| `REJECTED` | Da correggere; mostra motivo e revisione ricevuta | Correggi in bozza e reinvia, oppure elimina se senza prestiti |

L'approvazione pubblica l'oggetto, **non approva un prestito**. Il rifiuto richiede un motivo leggibile dal socio. Una richiesta di chiarimento resta `PENDING` con un messaggio: non servono altri stati.

Per modificare nome, descrizione, categoria o foto di un oggetto già approvato, nella prima versione si usa «Ritira dal catalogo e modifica» e si torna in bozza, con nuova revisione. L'azione è disponibile solo senza pratiche aperte o prestiti approvati non conclusi; negli altri casi la pagina indica quali pratiche chiudere e consente la pausa. Questo evita di aggiungere subito un sistema di versioni parallele della scheda.

La pausa usa `isBookable = false`: la scheda resta visibile, i nuovi prestiti sono sospesi, quelli esistenti continuano. L'archiviazione usa `archivedAt` e rimuove il pezzo dai kit secondo le regole esistenti. Il percorso ordinario del socio richiede di chiudere le pratiche aperte prima di archiviare; gli admin conservano l'archiviazione eccezionale, anche per un oggetto perso durante un prestito, con avviso e registrazione dell'intervento. Non si cancellano oggetti con uno storico di `RequestItem`.

Una proposta eliminabile viene cancellata solo dopo un controllo server sul proprietario e sull'assenza di prestiti, con pulizia dei file e traccia amministrativa essenziale. Il dialogo distingue «Ritira in bozza» da «Elimina proposta» e spiega la conseguenza sulla chat.

### Pratica di prestito

`RequestStatus` conserva soltanto `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`. Consegna e restituzione restano `pickedUpAt` e `returnedAt` sui singoli `RequestItem`, comprese le restituzioni parziali. Nessuno stato `IN_USE` viene salvato su `Asset` o `Request`.

La disponibilità continua a derivare dal motore esistente: le richieste in attesa non riservano l'oggetto, quelle approvate lo occupano secondo le regole attuali. L'interfaccia lo deve dire al richiedente. La verifica decisiva avviene all'approvazione, perché tra invio e decisione un'altra richiesta potrebbe essere stata approvata.

Le modifiche delle date mantengono le regole attuali: intervalli inclusivi, giorni UTC, limite ordinario, motivazione per periodi speciali e ritorno in attesa quando occorre una nuova decisione. La cancellazione e la modifica delle date non sostituiscono la restituzione di pezzi già consegnati.

## 5. Le schermate e la navigazione

Si riutilizzano `PageShell`, `Button`, `ButtonLink`, `Dialog`, `useConfirm`, `AssetFields`, `PhotoFields`, `PersonName` e `Avatar`. Niente nuova libreria di componenti, palette o font. Le nuove schermate devono funzionare nelle skin Classico e Riso, in chiaro e scuro, tramite token semantici in `app/app.css`. Gli stati hanno testo e colore appropriato; l'accento rimane associato all'azione.

Nel menu profilo aggiungiamo **I miei oggetti** e **Prestiti dei miei oggetti**. Le richieste fatte dall'utente rimangono su `/requests`. Il pulsante **Presta** introduce il flusso; su telefono la navigazione deve restare compatta e non sommare tutte le destinazioni all'header. Per gli admin, **Proposte** entra nel menu di gestione e il Centro mostra quante aspettano una revisione, distinguendole dalle richieste di prestito.

| URL | Scopo e struttura |
| --- | --- |
| `/presta` | Modulo a colonna singola: nome, descrizione, categoria facoltativa, foto. Azioni «Salva bozza» e «Invia per revisione». Spiegazione breve di cosa succederà dopo. |
| `/account/items` | Elenco dei propri oggetti, ricerca e filtro per pubblicazione. Foto, nome, stato, prossimo passo e accesso al dettaglio. Vuoto iniziale con invito a proporre il primo oggetto. |
| `/account/items/:id` | Scheda privata: stato, motivo dell'eventuale rifiuto, anteprima, azioni pertinenti, chat di revisione e collegamento ai prestiti dell'oggetto. |
| `/account/lending` | Inbox del prestatore: prima le richieste da decidere, poi ritiri, restituzioni e messaggi non letti. Filtri semplici e cronologia, senza duplicare il pannello admin. |
| `/admin/proposals` | Coda delle proposte: foto, oggetto, socio, data di invio e messaggi non letti. Ordinamento per attesa, filtri per stato e ricerca. |
| `/admin/proposals/:id` | Revisione: scheda e foto, campi correggibili, chat e decisione. Motivo obbligatorio per il rifiuto, conferma chiara per la pubblicazione. |
| `/requests/:id` | Un solo dettaglio per prestatore, richiedente e admin. Contenuti e azioni dipendono dalla relazione con la pratica. |
| `/requests/batches/:id` | Riepilogo privato di un invio composto da più richieste; visibile al richiedente e agli admin. Ogni prestatore vede la propria richiesta, non il riepilogo di altri proprietari. |

Le rotte vanno registrate esplicitamente in `app/routes.ts`; non si assume che `/account` abbia già un layout con `Outlet`.

### Composizione sullo schermo

```text
I miei oggetti                         [Presta un oggetto]
[Tutti] [In revisione] [Pubblicati] [Da correggere]

[foto] Trapano        In revisione
       Inviato il 9 ottobre · Un messaggio da leggere
       [Apri proposta]

[foto] Proiettore     Pubblicato · Prestiti in pausa
       1 richiesta da gestire
       [Gestisci oggetto] [Apri richiesta]
```

```text
Riepilogo prima dell'invio
Date: 12–14 ottobre              Motivo: laboratorio

Material Matters                 2 oggetti · 1 richiesta
[foto] Cavalletto                 [foto] Microfono

Oggetti di un socio · gruppo 1    1 oggetto · 1 richiesta
[foto] Trapano

Invieremo 2 richieste, gestite separatamente.
Ogni richiesta deve essere approvata prima del ritiro.
                                  [Invia 2 richieste]
```

I nomi dei proprietari non vengono aggiunti al catalogo o alla risposta pubblica per costruire questo riepilogo. Prima dell'invio i gruppi personali hanno etichette neutre; dopo la creazione della pratica, il dettaglio privato presenta il prestatore con i componenti per le persone già esistenti.

Su desktop, la revisione può affiancare scheda e conversazione. Su mobile resta una sola colonna: titolo e stato, campi/foto, decisione, conversazione, evitando azioni duplicate e barre che coprono il contenuto. L'elenco diventa una serie di righe o card leggibili, senza richiedere lo scorrimento orizzontale di una tabella.

### Feedback e accessibilità

- Ogni invio mostra stato occupato, impedisce doppio submit e produce un esito leggibile. «Proposta inviata» indica che la pubblicazione aspetta la revisione; «Richieste inviate» non promette un'approvazione.
- Gli errori rimangono vicino ai campi, con riepilogo accessibile quando necessario. Nome, descrizione e categoria non vanno persi dopo un errore; le foto da riselezionare vengono indicate esplicitamente.
- Se una foto è corrotta o supera i limiti, il problema è mostrato: non viene ignorato come nel form attuale. La bozza permette di recuperare il lavoro senza inviare una proposta incompleta in silenzio.
- Etichette vere, focus visibile, navigazione da tastiera, ritorno del focus dopo i dialoghi, `aria-busy` e annunci degli esiti. Stato comprensibile anche senza distinguere i colori.
- Interazioni principali da almeno 44 px; la misura compatta da 36 px resta limitata alle tabelle admin secondo CLAUDE.md. Un toggle di pausa ha etichetta esplicita e spiega che i prestiti esistenti restano validi.
- Titoli, messaggi, errori e meta passano dalle chiavi tipizzate en/it/de. I nomi degli oggetti e i messaggi degli utenti non vengono tradotti. Commenti e documentazione sono in italiano.

## 6. Il carrello con più proprietari

Il raggruppamento è una responsabilità del server. Un `ownerId` salvato nel carrello del browser non è una fonte autorevole; il server rilegge gli oggetti prima del riepilogo e prima della creazione.

1. Deduplicare gli ID e validare date, motivazione e provenienza dai kit. Un riferimento `fromKitId` deve corrispondere davvero al pezzo; non concede permessi.
2. Caricare gli oggetti con `select` espliciti e controllare esistenza, pubblicazione, archiviazione, prenotabilità e divieto di richiesta a sé stesso.
3. Raggruppare per proprietario: `ownerId = null` è il gruppo Material Matters; ogni socio è un altro gruppo. L'anteprima autenticata restituisce soltanto i dati necessari e le etichette neutre.
4. Al submit, rileggere e ricontrollare gli oggetti. Se una proposta è stata ritirata, messa in pausa o ha un conflitto noto, mostrare quali pezzi correggere. Nessuna creazione parziale.
5. Creare un lotto e una `Request` per gruppo nella stessa transazione. Tutte hanno date e motivazione coerenti; ogni `RequestItem` appartiene a una sola richiesta del lotto.
6. Usare una chiave di invio stabile per deduplicare retry e doppio submit. Conservarla in `sessionStorage` insieme all'impronta del contenuto normalizzato; cambiarla quando cambiano pezzi, date o motivo, non quando si ritenta un invio identico. Il server calcola autonomamente l'impronta. Riutilizzare una chiave con un contenuto diverso produce un errore; un retry identico restituisce le richieste già create, senza nuove email. La protezione deve gestire anche la collisione sulla chiave unica tra due submit simultanei.
7. Svuotare il carrello solo dopo un risultato confermato. Un errore o una risposta persa lascia possibile recuperare il riepilogo. Se nasce una sola richiesta si apre direttamente il dettaglio; se sono più di una si apre il lotto.

Il risultato dell'action diventa tipizzato, ad esempio `{ ok: true, batchId, requestIds }`; il consumer in `cart-bar.tsx` cambia insieme all'action. Non si lascia il vecchio redirect verso `fetcher.data.id` dopo aver introdotto più ID.

Il lotto serve al riepilogo, non ha un proprio stato decisionale. Una richiesta può essere approvata e un'altra rifiutata: il riepilogo mostra i singoli esiti e azioni separate. Nella prima versione non esiste «annulla tutto», che diventerebbe ambiguo dopo una consegna parziale.

## 7. Modello dati proposto

| Modello | Aggiunta o modifica | Motivo |
| --- | --- | --- |
| `Asset` | Conservare `ownerId`; relazione proprietario `Restrict`. Proprietà non modificabile dal socio e nessun trasferimento nella prima versione. | Non reinterpretare un oggetto personale come oggetto della sede; mantenere stabile la responsabilità. |
| `Asset` | Default per i nuovi record `DRAFT`; creazione admin istituzionale e seed esplicitamente `APPROVED`, invio socio esplicitamente `PENDING`. Verificare tutti i punti di creazione. | Il percorso di scrittura determina consapevolmente la pubblicazione. I record già presenti conservano il loro valore. |
| `Asset` | `submittedAt`, `reviewedAt`, `reviewedById`, `rejectionReason`, `ownerSeenAt`, `moderatorSeenAt`. | Ordinamento della coda, esito comprensibile e segnalibri della chat di revisione. Il registro conserva le decisioni precedenti ai reinvii. |
| `Request` | `lenderId` nullable, relazione distinta da `userId`, `onDelete: Restrict`. | `userId` rimane il richiedente; `lenderId` identifica il prestatore al momento dell'invio. `null` significa Material Matters. Non si ricalcola dallo stato attuale dell'oggetto. |
| `Request` | `lenderSeenAt`, lasciando `userSeenAt` e `adminSeenAt`. | Lettura indipendente di prestatore, richiedente e team admin. |
| `RequestBatch` | `id`, `userId`, `submissionKey`, impronta del contenuto normalizzato, `createdAt`; unicità su `(userId, submissionKey)`. | Collegare richieste sorelle e deduplicare gli invii. Il lotto non duplica date, motivo o stato. |
| `Request` | `batchId` nullable e relazione al lotto. | Compatibilità con le richieste precedenti, che rimangono apribili senza lotto. |
| `AssetMessage` / `Message` | Conservare la separazione esistente; indici composti per padre e data, se richiesti dalle query. | La chat di revisione e quella del prestito hanno destinatari e autorizzazioni diversi. |
| Registro invii chat | Segnalibro persistente per conversazione e destinatario, con ultimo messaggio notificato e momento dell'invio. | Deduplicare notifiche e limitare le raffiche senza affidarsi alla memoria di un processo. Riutilizzare un registro compatibile se disponibile; altrimenti una piccola tabella dedicata. |

Indici da predisporre per le query effettive: asset per `(ownerId, status)`, coda per `(status, submittedAt)`, richieste per `(lenderId, status)` e `batchId`. Non aggiungere indici indiscriminatamente.

Le nuove relazioni e i segnalibri vanno aggiunti con nuove migrazioni; quella P2P già applicata non si riscrive. I prestiti precedenti rimangono istituzionali con `lenderId = null`. Prima del backfill, verificare se esistono richieste contenenti asset con `ownerId` personale: un caso ambiguo o misto richiede una ricostruzione esplicita, non un'associazione inventata.

La cancellazione dell'account non può azzerare la responsabilità di un prestatore. La prima versione non offre cancellazione fisica di account con oggetti o pratiche P2P collegati; un'eventuale procedura futura di anonimizzazione va progettata preservando storico e responsabilità. Nessuna riscrittura generale delle altre relazioni utente è parte di questo piano.

## 8. Organizzazione del codice e consistenza

Introdurre pochi moduli condivisi, ciascuno con una responsabilità concreta:

- `asset-publication.server.ts`: criterio di pubblicazione riutilizzato da catalogo, dettaglio, calendario, kit, conteggi e risorse pubbliche; proiezioni esplicite senza identità personali. Separare questo filtro dalla disponibilità: un oggetto non visibile può ancora avere una pratica privata da concludere.
- `request-access.server.ts`: identità di richiedente/prestatore/admin, accesso al record e capacità di agire. Evitare `isOwner` per indicare il richiedente nel dettaglio: usare nomi distinti e verificabili.
- `request-submission.server.ts`: creazione del lotto, raggruppamento, deduplicazione, validazioni e transazione. La funzione pura di raggruppamento e la valutazione delle capacità possono vivere in un file condiviso testabile senza database.
- `asset-proposals.server.ts`: invio, ritiro, decisione, controllo delle transizioni e validazioni. Le rotte non devono replicare queste regole.

Si usano loader/action di React Router, `useFetcher` per le azioni sul posto e revalidation; non serve un secondo sistema di API o di stato globale. Le action con più operazioni usano intent espliciti e un dispatch centralizzato, verificando i permessi per ciascun intent.

### Concorrenza e decisioni

L'approvazione di un prestito deve bloccare gli asset coinvolti, in ordine stabile, dentro una transazione e rieseguire il controllo di sovrapposizione prima della scrittura. `getBusyAssetIds` deve poter usare il client della transazione; una query sul client globale vanificherebbe il controllo. Usare query parametrizzate `Prisma.sql`, mai SQL costruito concatenando valori.

La stessa disciplina deve valere per tutti i percorsi che creano o cambiano una prenotazione approvata, compresa la consegna diretta admin. Altrimenti il flusso P2P sarebbe sicuro soltanto quando nessun altro percorso scrive contemporaneamente. L'ordine dei lock deve essere condiviso per prevenire deadlock evitabili.

Approvazione, rifiuto e ritiro di una proposta verificano stato e revisione attesi. Due admin non devono poter sovrascrivere una decisione, né pubblicare una scheda modificata dopo che l'hanno letta. Una decisione non più valida produce «La proposta è cambiata, rileggila», senza perdere la conversazione.

### Foto e dati privati

La soluzione proposta riutilizza gli URL delle foto, aggiungendo in `uploads.tsx` una verifica server per i percorsi degli asset: foto e miniatura vengono risolte tramite `AssetPhoto`, non soltanto dal nome di file. Per un oggetto approvato e non archiviato sono pubbliche; per una bozza/proposta le vedono solo proprietario e admin. Percorsi sconosciuti o non autorizzati rispondono 404; avatar e altri upload mantengono il comportamento previsto per il loro uso.

Le foto degli oggetti personali usano una politica di cache compatibile con il cambio di pubblicazione, senza `public, immutable` annuale; le risposte riservate sono `private, no-store`. L'autorizzazione precede qualsiasi lettura o risposta condizionale. Foto già servite pubblicamente possono essere state scaricate o conservate in cache: la protezione nuova non le rende retroattivamente segrete. Questo limite va documentato, e il futuro flusso di bozza deve nascere con la protezione già attiva.

L'upload prepara e valida i file prima dell'invio per revisione. Se la scrittura fallisce, pulisce i file temporanei; se una foto fallisce, conserva la bozza e mostra come correggerla. Il service worker continua a non memorizzare HTML, loader o risposte private. Le pagine e risorse private mantengono header adeguati e non espongono note interne nei `select`.

## 9. Chat, inbox e aggiornamenti dal vivo

La chat di revisione ammette il proprietario dell'asset e gli admin. La chat del prestito ammette richiedente, prestatore della richiesta e admin. Le due cronologie rimangono distinte e ogni pagina spiega a chi è destinato il messaggio.

I non letti dipendono da **chi sta leggendo e chi ha scritto**, non dal ruolo corrente dell'autore. Un richiedente admin deve essere contato come richiedente nella sua pratica; un prestatore socio come prestatore; un messaggio proprio non va segnalato come nuovo. Se un admin interviene come operatore, la vista operativa usa il segnalibro del team; quando legge una pratica personale usa quello della sua partecipazione. Evitare di aggiornare tutti i segnalibri per una sola apertura.

Si estende `api.stream.tsx` per autorizzare il prestatore sul canale della richiesta, il proprietario sul canale della proposta e la persona sulla propria inbox prestiti. Il canale admin resta amministrativo. Le SSE trasportano invalidazioni, mai nomi, testi, note o foto; i contenuti arrivano dai loader autorizzati.

Riutilizzare heartbeat, chiusura all'abort, limite per persona e polling di fallback esistenti. Verificare i diritti a ogni connessione; una sessione scaduta o un ruolo revocato non deve poter riaprire un canale privilegiato. Dopo una scrittura pubblicare le invalidazioni soltanto a commit riuscito.

## 10. A chi arrivano le notifiche

Gli switch admin esistenti continuano a regolare le comunicazioni amministrative, senza cambiare i permessi. Un socio che presta riceve invece le comunicazioni relative alle proprie pratiche, attraverso le preferenze personali email/push già esistenti. Vale anche per un proprietario che è admin e ha disattivato le email amministrative.

| Evento | Destinatari |
| --- | --- |
| Nuova proposta o reinvio | Admin selezionati per le notifiche amministrative, secondo il resolver esistente. |
| Messaggio di revisione del socio | Team di revisione tramite inbox e destinatari admin selezionati; escluso l'autore. |
| Messaggio/decisione dell'admin sulla proposta | Proprietario dell'oggetto; escluso l'autore se coincidente. |
| Nuova richiesta Material Matters | Destinatari amministrativi selezionati, come oggi. |
| Nuova richiesta P2P | Prestatore di quella richiesta; la visibilità admin per assistenza rimane, senza inviare automaticamente la pratica a tutta la mailing list. |
| Approvazione/rifiuto | Richiedente. L'esito è visibile ai partecipanti autorizzati. |
| Modifica o cancellazione del richiedente | Prestatore P2P oppure destinatari amministrativi istituzionali. |
| Messaggio nella chat del prestito | L'altro partecipante personale; per le pratiche istituzionali il team selezionato. Un intervento admin P2P raggiunge entrambi i partecipanti, escluso l'autore. |
| Ritiro/restituzione e promemoria | Partecipanti pertinenti all'evento; il richiedente conserva i promemoria personali esistenti. |
| Riepilogo dei ritardi | Admin selezionati per gli oggetti della sede; ciascun prestatore solo per i propri prestiti. Nessun riepilogo globale ai soci. |

Deduplicare per persona/email, rispettare il canale personale ed escludere l'autore. Gli indirizzi extra configurati per il team non ricevono automaticamente conversazioni personali P2P. Le push mantengono testi generici, senza nomi di persone, oggetti o luoghi; i dettagli si leggono dopo l'accesso. Le email possono usare i dati autorizzati del singolo destinatario.

L'invio avviene dopo il commit e un errore del provider non annulla la richiesta o la pubblicazione: il servizio registra l'errore e la pratica resta visibile nella inbox. Un retry di un lotto già creato non ripete le notifiche iniziali. L'invio delle notifiche resta best effort nella prima versione; una garanzia di consegna richiederebbe una coda persistente, fuori da questo primo rilascio.

Per la chat, notificare soltanto messaggi nuovi non ancora letti dal destinatario: primo avviso immediato, poi al massimo un avviso ogni cinque minuti per persona e conversazione. Un segnalibro persistente evita doppioni tra worker; una revalidation o il fallback SSE non genera invii. Non serve un timer che rispedisca vecchi messaggi: la cronologia completa resta nella inbox. I promemoria e digest hanno deduplicazione per destinatario e periodo: il digest di un prestatore non deve sopprimere quello di un altro.

## 11. Collegamenti con le funzioni esistenti

- **Centro admin:** separare oggetti della sede, proposte e assistenza P2P. I conteggi devono riflettere ciò che gli admin possono gestire, senza far passare la pubblicazione per una prenotazione.
- **Gestione asset:** mostrare la provenienza e il proprietario nei soli contesti amministrativi. Creare un oggetto della sede e proporre un oggetto personale sono intent distinti; un admin non pubblica involontariamente un proprio oggetto come materiale della sede.
- **Kit:** i selettori admin accettano oggetti istituzionali approvati e non archiviati. Controllare eventuali kit già misti; segnalarli per correzione esplicita, senza far sparire elementi in silenzio. Il carrello conserva la deduplicazione dopo l'espansione.
- **QR e consegna diretta:** mantenere validi gli URL stampati. Un QR di una proposta non apre la consegna admin; un oggetto P2P non viene trattato come istituzionale. Il socio registra consegna e restituzione dal dettaglio della propria pratica; una consegna diretta P2P da admin è un intervento esplicito con `lenderId` corretto e gli stessi controlli di conflitto.
- **Calendario pubblico:** soltanto oggetti pubblicati, senza identità. **Calendario personale:** conservare il feed dei propri prestiti e i suoi header/token; il calendario dei prestiti effettuati resta nella inbox per questa versione, senza introdurre un feed globale o un secondo token.
- **Registro:** tracciare invio, ritiro, decisione, pausa, archiviazione e interventi admin, senza copiare conversazioni o dati riservati superflui. Le operazioni dei soci non creano un ruolo admin; usare il modello di audit con attore e azione appropriati.

## 12. Sviluppo in fasi e criteri di uscita

Le fasi vengono sviluppate e mostrate in locale. La pubblicazione della funzione completa avviene dopo la verifica dell'intero percorso; una schermata funzionante da sola non costituisce un rilascio P2P.

| Fase | Lavoro e principali file | Criterio di uscita |
| --- | --- | --- |
| 0 — Base coerente | Inventario dati e migrazioni; `schema.prisma`; filtro pubblico; `catalogue.tsx`, `item.tsx`, `calendar.tsx`, `availability.tsx`, kit e upload. Correggere identità, categorie e cancellazioni. | Proposte invisibili e non prenotabili da utenti estranei; foto riservate protette; catalogo istituzionale invariato nel comportamento. |
| 1 — Proporre e gestire | Completare `presta.tsx`, creare le due pagine `/account/items`, registrare rotte, menu profilo, validazioni e traduzioni. | Un socio salva, recupera, invia, ritira o elimina la propria proposta; l'esito porta a una pagina reale e nessun upload fallisce in silenzio. |
| 2 — Revisionare e pubblicare | Coda e dettaglio `/admin/proposals`, `AssetMessage`, metadati della revisione, audit e notifiche di esito. | Un admin legge, corregge, conversa e decide; un secondo admin vede decisioni aggiornate; un rifiuto spiega cosa correggere. |
| 3 — Richiedere a più proprietari | `RequestBatch`, `Request.lenderId`, servizio di creazione, `requests.tsx`, `cart-bar.tsx`, riepilogo del lotto e idempotenza. | Un carrello misto produce esattamente una richiesta per proprietario; retry senza duplicati; nessuna richiesta parziale in caso di errore. |
| 4 — Gestire i prestiti personali | Capacità condivise, `request-detail.tsx`, `/account/lending`, inbox, SSE e transazioni di approvazione/consegna. | Ogni prestatore decide solo sulle proprie pratiche; consegna e restituzione parziali funzionano; approvazioni concorrenti non sovrappongono prestiti. |
| 5 — Notificare e rifinire | `notifications.server.ts`, `reminders.server.ts`, destinatari, Centro, QR, feedback e verifiche delle skin. | Email/push arrivano ai partecipanti corretti; nessun digest P2P globale; UI comprensibile e utilizzabile su telefono e desktop. |
| 6 — Chiudere e documentare | Verifica completa in browser, guida d'uso, aggiornamento di CLAUDE.md per le nuove invarianti e le foto delle proposte, changelog/versione. | Tutti i criteri sotto soddisfatti, limiti residui dichiarati, piano segnato fatto solo a completamento effettivo. |

Le fasi 2 e 3 dipendono dalla base dati della fase 0; la gestione del prestatore dipende dallo splitting e dai permessi condivisi. Le notifiche vanno predisposte nei servizi sin dall'inizio e completate quando i partecipanti sono definiti. Nessuna stima numerica viene data prima di avere chiarito eventuali dati P2P già creati e verificato le query reali.

## 13. Verifica prima di considerare il lavoro finito

Account di prova distinti: socio prestatore A, socio prestatore B, richiedente, admin con email attive e admin con email disattivate. Dati dedicati locali, senza usare le prenotazioni reali come fixture e senza reset del database.

**Test automatici:** `pnpm typecheck`, `pnpm build`, `pnpm test`; nuovi test Vitest soltanto sulle funzioni pure, come richiesto da CLAUDE.md: raggruppamento e deduplicazione, chiave/impronta di invio, matrice delle capacità, transizioni consentite, destinatari e date. Nessun nuovo framework di rendering o integration test.

**Prove manuali documentate in locale**, anche con richieste HTTP dirette dove la UI non basta:

1. Dal socio A: bozza con foto, errore di upload, invio, conversazione admin, rifiuto motivato, correzione, reinvio e pubblicazione. Poi pausa e ripresa, ritiro protetto e cancellazione di una proposta senza storico.
2. Da anonimo e socio B: URL e payload diretti non leggono proposta, chat, foto o metadati del socio A. Un ID non approvato non entra in una richiesta; il JSON pubblico non contiene identità, location o note interne.
3. Carrello con Material Matters, A e B: tre richieste, una per gruppo. Oggetto duplicato da kit e catalogo una sola volta; nessuna richiesta a sé stesso. Un errore su un pezzo conserva tutto il carrello e non crea pratiche parziali.
4. Doppio clic, retry identico e risposta persa: un solo lotto, stessi ID, nessuna seconda notifica. Chiave riutilizzata con payload diverso rifiutata.
5. Due richieste sovrapposte approvate da due sessioni: una sola può impegnare gli stessi pezzi. Ripetere con il percorso di consegna diretta. Verificare anche una modifica delle date e un oggetto messo in pausa durante il riepilogo.
6. Prestatore A: vede e gestisce solo i suoi pezzi, non quelli di B né l'intero lotto del richiedente. Un richiedente admin e un prestatore admin non confondono capacità personali, segnalibri o destinatari.
7. Consegna di più pezzi e restituzione parziale: si libera soltanto il pezzo restituito secondo il motore esistente; storico e richieste precedenti rimangono leggibili.
8. Chat revisione e chat prestito: partecipanti corretti, proprio messaggio non segnalato come nuovo, aggiornamento dal vivo e fallback; tentativi di connessione SSE non autorizzata rifiutati.
9. Notifiche attraverso un trasporto locale di prova: admin selezionati per attività amministrativa, A per i suoi prestiti anche con switch admin spento, nessuna email P2P personale a B o agli indirizzi extra del team; autore escluso e push senza dati privati.
10. Smartphone e desktop: 360/390/768/1280 px, tastiera, menu, focus, dialoghi, upload, carrello e testi lunghi; skin Classico/Riso in chiaro/scuro ed en/it/de. Verificare il viewport effettivo, non soltanto una richiesta di ridimensionamento al browser.
11. Regressione istituzionale: catalogo, kit, calendario, richieste storiche senza lotto, QR stampati, Centro, switch email admin, feed iCal personale e uscita dalla sessione con pagine private.

Registrare l'esito osservato delle prove, con screenshot delle schermate nuove e dei principali stati di errore. I test puri non dimostrano isolamento dei dati o comportamento delle transazioni: quelle verifiche devono essere eseguite davvero nelle prove locali previste.

## 14. Condizione di completamento

La funzione è completa quando due soci possono prestare oggetti diversi allo stesso richiedente, nello stesso invio, gestendo decisioni e conversazioni separate; gli admin possono moderare e assistere; le disponibilità rimangono corrette; ogni persona riceve soltanto le comunicazioni pertinenti; l'intero percorso è utilizzabile nelle interfacce e nei temi esistenti.

Prima del rilascio: backup, nuove migrazioni senza reset, verifica di applicazione, aggiornamento della documentazione e della versione secondo CLAUDE.md. Commit, push e distribuzione restano azioni da eseguire quando richieste. La stesura di questo piano non cambia la versione dell'app e non segna come realizzate le fasi di sviluppo.
