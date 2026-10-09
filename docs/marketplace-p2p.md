# Prestare gli oggetti dei soci

Da Fabula 0.12.0 il catalogo comprende gli oggetti di Material Matters e quelli
dei soci. I permessi admin restano invariati; ogni proprietario gestisce i
prestiti dei propri oggetti attraverso il suo account.

## Proporre e gestire un oggetto

1. Apri **Presta** oppure **I miei oggetti** dal menu del profilo. Su telefono
   Presta sta nel menu per mantenere compatta l'intestazione.
2. Inserisci nome, descrizione, categoria facoltativa e fino a dodici foto.
   **Salva bozza** conserva il lavoro senza pubblicarlo. Un upload non valido
   lascia il testo in una bozza recuperabile e indica quali foto riselezionare.
3. **Invia per revisione** rende la proposta disponibile al team. La chat della
   proposta serve a chiarire i dettagli prima della pubblicazione.
4. Dopo un rifiuto motivato, correggi e reinvia. Dopo la pubblicazione, lo
   switch **Accetta nuove richieste di prestito** sospende soltanto le richieste
   future: l'oggetto rimane visibile e i prestiti esistenti continuano.
5. Per cambiare i contenuti pubblicati usa **Ritira dal catalogo e modifica**:
   torna in bozza e richiede una nuova revisione. Occorre prima chiudere le
   pratiche aperte indicate nella scheda. Lo stesso vincolo protegge
   l'archiviazione ordinaria. Un oggetto con uno storico di prestiti resta
   conservato e non può essere eliminato.

Le bozze, le proposte e le relative foto sono accessibili soltanto al
proprietario e agli admin. Nel catalogo pubblico il proprietario personale è
indicato come **Un socio**; nomi, alias, avatar, indirizzi e note interne non
vengono aggiunti alle schede pubbliche.

## Richiedere e prestare

Il carrello mostra i gruppi prima dell'invio. Oggetti dello stesso proprietario
formano una richiesta; Material Matters forma un gruppo separato. Date e
motivazione sono comuni, ma decisioni, conversazioni e restituzioni restano
indipendenti. Un errore conserva il carrello e non crea richieste parziali.
Non è possibile richiedere i propri oggetti. I kit comprendono soltanto
oggetti istituzionali e continuano a sciogliersi nei singoli pezzi.

Un invio ripetuto con la stessa chiave e gli stessi dati recupera le pratiche
già create. Il browser conserva le chiavi degli invii tentati anche quando
si chiude e riapre il riepilogo; le rimuove dopo una risposta di successo.
L'invio non riserva gli oggetti: occorre l'approvazione del prestatore.

In **Prestiti dei miei oggetti** il proprietario trova richieste da decidere,
messaggi e prestiti attivi. Dal dettaglio può approvare o rifiutare, concordare
il ritiro, registrare la consegna e la restituzione di ciascun pezzo. Una
restituzione parziale libera soltanto quel pezzo. Dopo il ritiro si conclude
il prestito registrando la restituzione; cancellazione e modifica delle date
sono bloccate.

Chi richiede un carrello misto riceve un riepilogo privato con un collegamento
a ogni pratica. Ogni prestatore vede soltanto la propria pratica. Il team
admin può assistere; le note interne rimangono visibili soltanto agli admin.

## Revisione e assistenza admin

**Gestione → Proposte**, oppure il collegamento nel Centro, apre la coda di
revisione. Filtri e ricerca permettono di ritrovare anche bozze, proposte
rifiutate e oggetti già pubblicati. L'admin legge la scheda, corregge i campi,
conversa con il proponente e pubblica con conferma oppure richiede correzioni
con un motivo obbligatorio. Una decisione basata su una revisione superata
viene rifiutata e chiede di rileggere la scheda.

Il Centro separa i prestiti Material Matters dai prestiti dei soci. Sulla
scheda di una proposta pubblicata, **Gestisci come admin** mantiene l'accesso
alle correzioni amministrative e all'archiviazione eccezionale, anche per un
oggetto perso durante un prestito. L'intervento viene registrato e comunicato
al proprietario; l'archiviazione avvisa anche i partecipanti alle pratiche
aperte. Il QR conserva l'URL esistente e la consegna diretta admin conserva
il proprietario nella pratica.

## Notifiche

Gli switch in **Soci → Destinatari email degli oggetti** regolano gli avvisi
amministrativi. Non cambiano i ruoli o gli avvisi personali.

- Proposte e chat di revisione: admin selezionati; esito al proprietario.
- Nuove richieste P2P: al proprietario, senza copia al resto dei prestatori
  o agli indirizzi aggiuntivi del team.
- Decisioni e aggiornamenti del prestito: ai partecipanti pertinenti, escluso
  l'autore. Un admin prestatore riceve gli avvisi personali anche con switch
  amministrativo disattivato.
- Chat: primo avviso immediato, poi al massimo uno ogni cinque minuti per
  conversazione e destinatario; nessun avviso per un messaggio già letto.
- Ritardi: riepilogo personale per prestatore, distinto da quello
  istituzionale. I promemoria al richiedente mantengono la finestra 8–20 di Roma.

Chat, inbox, coda e riepilogo dell'invio si aggiornano tramite SSE autorizzate,
con il ripiego periodico esistente. Il canale trasporta soltanto un segnale:
i dati vengono riletti dai loader con gli stessi permessi.

L'invio delle email è best effort: un errore del provider non annulla una
pratica già salvata. Non è stata introdotta una coda persistente di consegna.
Le push mantengono lo stato sperimentale e disattivato del progetto.

## Migrazioni e rilascio

Applicare le nuove migrazioni con la procedura di rilascio esistente, dopo un
backup, senza reset o seed sul database operativo. La migrazione di completamento
si ferma se trova prestiti personali antecedenti senza una responsabilità
definita: in quel caso occorre verificare i dati e prepararne il backfill.
Non sceglie arbitrariamente un prestatore per le pratiche storiche.

Gli asset istituzionali esistenti mantengono il loro stato; creazione admin e
seed dichiarano esplicitamente `APPROVED`. Per le nuove righe il default è
`DRAFT`. La disponibilità continua a essere calcolata dalle prenotazioni e
non si salva nello stato di pubblicazione.

Riferimenti: [piano](piani/2026-10-08-marketplace-p2p.md),
[verifica locale](verifiche/2026-10-09-marketplace-p2p.md).
