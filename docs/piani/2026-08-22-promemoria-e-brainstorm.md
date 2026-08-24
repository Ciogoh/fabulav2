# Promemoria automatico, notifiche, e il resto del brainstorm

## Contesto

Ultimo pezzo del brainstorm fatto qualche giro fa (barra admin colorata,
calendario, modificare le date, annullare, ritiro/riconsegna), più le due
cose chieste esplicitamente dopo: notifiche a chi ha fatto la richiesta su
ogni decisione, e il promemoria automatico il giorno prima della
riconsegna — priorità #4 della lista originale di `fabula/CLAUDE.md`, mai
costruita, finora solo manuale (il bottone su `/requests/:id`).

Le decisioni di design erano già state discusse e non sollevate obiezioni,
le riprendo qui invariate: modificare le date di una richiesta approvata la
rimanda in "in attesa" (una nuova approvazione serve sempre); annullare è
bloccato se anche un solo oggetto è già stato ritirato; il ritiro non ha
vincoli di data (un admin può segnarlo anche in anticipo, è una sua scelta).

**Le email restano tutte in italiano**, non tradotte per lingua del
destinatario — è già così per ogni email esistente in Fabula (codice OTP,
notifica agli admin, reset password, promemoria manuale), quindi le nuove
seguono lo stesso schema invece di inventare un sistema a parte.

## Schema

Un solo campo nuovo, su `Request`:

```prisma
/// Quando è partito il promemoria automatico di riconsegna. Evita di
/// mandarlo due volte se il processo riparte lo stesso giorno.
reminderSentAt DateTime?
```

Migrazione con la skill `prisma-migration` appena creata (primo uso vero).

## Un posto solo per le email

Oggi l'email agli admin per una richiesta nuova è scritta a mano dentro
`app/routes/requests.tsx`. La sposto, insieme alle nuove, in
**`app/lib/notifications.server.ts`**:

- `notifyAdminsNewRequest(...)` — spostata da `requests.tsx`, invariata.
- `notifyRequesterDecision(request, decision)` — nuova: a chi ha fatto la
  richiesta, quando un admin approva o rifiuta.
- `notifyRequesterCancelled(request)` — nuova: solo quando è **l'admin** ad
  annullare (se è la persona stessa ad annullare la propria richiesta non
  serve avvisarla di quello che ha appena fatto).
- `sendReturnReminder(request)` — nuova, **condivisa** fra il bottone
  manuale già esistente su `/requests/:id` e lo spazzatore automatico, così
  il testo dell'email non si scrive due volte.

Tutte via `try/catch` che logga e non blocca l'azione — stesso schema già
in uso per la notifica agli admin.

## Il promemoria automatico

**`app/lib/reminders.server.ts`** (nuovo): un controllo **una volta
all'ora** (non un vero cron — non serve, `setInterval` con un guardiano sul
giorno già fatto basta ed evita una dipendenza in più), che una volta al
giorno cerca le richieste `APPROVED` con `endDate` domani, almeno un
oggetto ritirato e non ancora restituito, e `reminderSentAt` ancora nullo —
manda `sendReturnReminder` e segna il campo.

Avviato una volta sola all'avvio del processo, con lo stesso schema già in
uso in `app/lib/db.server.ts` per il client Prisma (cache su `globalThis`,
altrimenti Vite lo farebbe ripartire a ogni ricarica in sviluppo). Richiamo
da `app/root.tsx`, a livello di modulo.

## `/requests/:id` — le azioni nuove

Nello stesso schema a `intent` già in uso:

- **`editDates`** — chi ha fatto la richiesta o un admin, solo se lo stato
  è `PENDING` o `APPROVED`. Stessa validazione della creazione (tetto 7
  giorni, spunta + motivo per andare oltre), stesso controllo conflitti
  (`getBusyAssetIds`, a cui aggiungo un parametro `excludeRequestId` — senza,
  una richiesta già approvata risulterebbe in conflitto con sé stessa). Se
  lo stato era `APPROVED` torna `PENDING` e si azzerano `decidedAt`/
  `decidedById`.
- **`cancel`** — chi ha fatto la richiesta o un admin. Rifiutato se un
  `RequestItem` ha già `pickedUpAt` non nullo. Stato → `CANCELLED` (esiste
  già nell'enum, mai usato finora). Libera l'oggetto da solo — il motore di
  disponibilità guarda solo `APPROVED`.
- **`pickup` / `return`** — solo admin, per singolo oggetto (mai per
  l'intera richiesta, altrimenti una riconsegna parziale non si potrebbe
  fare — è una regola già scritta in CLAUDE.md), solo su richieste
  `APPROVED`. Nessun vincolo di data.
- **`approve` / `reject`** esistenti: aggiungo la chiamata a
  `notifyRequesterDecision`.

Il date-picker (tetto 7 giorni, spunta, campo motivo) usato oggi solo nel
dialogo "Richiedi" del catalogo va **estratto in un componente condiviso**
(`app/components/date-range-fields.tsx`), perché ora serve identico anche
qui per `editDates`. `catalogue.tsx` passa a usarlo invece della sua
versione inline.

## Calendario

In `calendar.tsx`:

- **Mesi**: oggi l'etichetta del mese guarda solo il primo giorno della
  finestra di 35 giorni, che spesso ne attraversa due — aggiungo una riga
  divisoria dove cambia il mese e un'etichetta per segmento.
- **Continuazione fuori finestra**: una barra che si sovrappone a `richiesta
  speciale` più lunga della finestra oggi si taglia in silenzio — aggiungo
  una freccia sul bordo quando l'occupazione vera continua oltre lo schermo.
- **Salto diretto**: un `<input type="month">` nella barra di navigazione
  che porta a `/calendar?from=<primo-del-mese>`, per non dover cliccare
  "Dopo" molte volte per una richiesta fra tre mesi.

## Barra admin riconoscibile

In `site-header.tsx`: quando `user.isAdmin`, l'intestazione prende una
leggera tinta rossa (`bg-out-bg`, lo stesso token già usato per il pallino
"Admin" — coerente invece di un colore nuovo prima del restyling vero,
priorità 7 di CLAUDE.md) invece del solito `bg-card`.

## Traduzioni

Solo per l'interfaccia (le email restano fisse in italiano): chiavi per
"Modifica date", "Annulla prenotazione" (+ conferma), "Segna ritirato" /
"Segna restituito", l'etichetta del salto al mese, ed eventuali errori
nuovi (`request.errorNotPendingOrApproved` per editDates fuori stato,
`request.errorAlreadyPickedUp` per un cancel bloccato). Tutte e tre le
lingue, verificate con `pnpm typecheck` (o con la skill `add-i18n-key`).

## File toccati

- `fabula/prisma/schema.prisma` + migrazione (`reminderSentAt`)
- `fabula/app/lib/availability.server.ts` (`excludeRequestId` su
  `getBusyAssetIds`)
- `fabula/app/lib/notifications.server.ts` (nuovo)
- `fabula/app/lib/reminders.server.ts` (nuovo)
- `fabula/app/root.tsx` (avvia lo spazzatore)
- `fabula/app/components/date-range-fields.tsx` (nuovo, estratto da
  `catalogue.tsx`)
- `fabula/app/routes/catalogue.tsx` (usa il componente condiviso)
- `fabula/app/routes/requests.tsx` (usa `notifyAdminsNewRequest` dalla
  nuova libreria)
- `fabula/app/routes/request-detail.tsx` (editDates, cancel, pickup,
  return, notifica su approve/reject, UI per tutto)
- `fabula/app/components/site-header.tsx` (tinta admin)
- `fabula/app/routes/calendar.tsx` (mesi, continuazione, salto al mese)
- `fabula/app/i18n/dictionaries.ts`

## Ordine di lavoro

Come sempre, un commit per pezzo compiuto: (1) schema + libreria
notifiche/promemoria + spazzatore, (2) azioni e interfaccia di
`/requests/:id` (editDates, cancel, pickup/return, notifiche su
approve/reject), (3) calendario e barra admin.

## Verifica

1. `pnpm typecheck` dopo ogni pezzo.
2. Promemoria: creare (via script, come per i test precedenti) una
   richiesta `APPROVED` con un oggetto ritirato e `endDate` = domani,
   avviare il server, controllare che l'email compaia in terminale (senza
   `RESEND_API_KEY`) e che `reminderSentAt` si valorizzi; riavviare il
   server e verificare che non parta una seconda volta.
3. Da proprietario: modificare le date di una richiesta `APPROVED` →
   verificare che torni `PENDING`; annullare una richiesta senza ritiri →
   verificare che l'oggetto torni libero nel catalogo; provare ad
   annullare una richiesta con un oggetto già ritirato → deve rifiutare.
4. Da admin: ritirare e poi restituire un oggetto singolo di una richiesta
   con più oggetti → verificare che il calendario/catalogo lo liberi
   subito, mentre gli altri oggetti della stessa richiesta restano occupati.
   Approvare/rifiutare → verificare l'email al richiedente in terminale.
5. Calendario: navigare su una finestra che attraversa un cambio di mese →
   verificare le due etichette; una richiesta speciale più lunga di 35
   giorni → verificare la freccia di continuazione; il salto diretto al
   mese.
6. Intestazione: accedere come admin → verificare la tinta; da utente
   normale resta invariata.
