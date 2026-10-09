# Piano Architetturale: Marketplace P2P (Presta un Oggetto)

> Documento iniziale, conservato come contesto. Il piano definitivo è
> [Prestare gli oggetti dei soci](docs/piani/2026-10-08-marketplace-p2p.md),
> attuato in **0.12.0**. Rispetto a questa base, il default dei nuovi asset è
> `DRAFT` e il catalogo pubblico indica «Un socio», senza nomi personali,
> secondo CLAUDE.md. Guida aggiornata: [marketplace P2P](docs/marketplace-p2p.md).

Questo documento contiene tutto il contesto e il piano per implementare la feature "Marketplace Peer-to-Peer" all'interno di Fabula, permettendo agli utenti registrati di mettere in prestito i propri oggetti.

## Architettura e Regole di Fabula
Fabula usa React Router v8, Vite, Tailwind v4, Prisma e Better Auth.
- **Mai usare colori hardcoded di Tailwind**: Usa sempre le variabili CSS (es. `var(--accent)`, `var(--rule)`, classi `bg-card`, `bg-out-bg`) per supportare il theme chiaro/scuro e le diverse skin.
- **Disponibilità Calcolata**: La disponibilità di un oggetto (`Free`, `In Use`, ecc.) viene calcolata dinamicamente in base alle prenotazioni (`RequestItem`). Non esiste un campo status della disponibilità sul database.

## Stato Attuale (Cosa è già stato implementato)

1. **Database Schema Aggiornato e Migrato**:
   - Creato l'enum `AssetStatus` (`DRAFT`, `PENDING`, `APPROVED`, `REJECTED`).
   - Aggiunto `ownerId` in `Asset` per collegarlo a uno User (se `null`, il proprietario è "Material Matters").
   - Aggiunto `status` in `Asset` col default a `APPROVED` (per retrocompatibilità).
   - Creata la tabella `AssetMessage` per la chat specifica tra admin e utente durante l'approvazione.

2. **Interfaccia Pubblica (Catalogo e Oggetto)**:
   - Aggiunta la dicitura **"Prestato da: [Nome]"** nelle schede del catalogo e nella pagina dettaglio oggetto (`app/routes/catalogue.tsx`, `app/routes/item.tsx`).
   - Le immagini nella pagina del singolo oggetto (`app/routes/item.tsx`) sono state ingrandite come richiesto.

3. **Bottone e Form di Proposta (`/presta`)**:
   - Aggiunto il tasto "Presta" nell'header in alto.
   - Creata la pagina `app/routes/presta.tsx`. Riutilizza i componenti `AssetFields` e `PhotoFields` esistenti. Per gli utenti non admin sono nascosti i campi `location` e `adminNotes`. L'oggetto viene salvato con `status: "PENDING"`.

## Cosa Manca da Sviluppare (Next Steps per Codex)

### Step 1: Dashboard Utente (`/account/items`)
Creare una rotta accessibile all'utente (es. in `/account/items` o come tab in `/requests`) dove l'utente può vedere gli oggetti che ha proposto per il prestito.
- Mostrare la lista degli oggetti proposti (con foto e nome).
- Mostrare lo `status` (`PENDING`, `APPROVED`, `REJECTED`).
- Dare la possibilità di cancellare la proposta se è ancora `PENDING`.

### Step 2: Sdoppiamento del Carrello (Cart Splitting)
Attualmente il carrello genera una singola `Request` per tutti gli oggetti.
Se il carrello contiene oggetti di **proprietari diversi**, il sistema deve dividere il carrello al momento del submit (in `app/routes/cart.tsx` o nell'action del form) e creare **richieste multiple**.
- Ogni richiesta (`Request`) conterrà solo gli oggetti di un singolo proprietario.
- In questo modo ogni proprietario gestirà la propria pratica separatamente.

### Step 3: Gestione Admin (`/admin/proposals`)
Gli admin devono poter vedere gli oggetti inseriti in stato `PENDING` per valutarli.
- Creare una sezione nel pannello admin (es. in `/admin` sotto forma di un tab separato o una voce in `ManageMenu`).
- La pagina mostrerà le richieste di inserimento catalogo.
- Cliccando sulla richiesta, l'admin aprirà una pagina che permette di:
  1. Mandare messaggi all'utente (creando un form che scrive su `AssetMessage`).
  2. Modificare campi (es. aggiungere categoria se mancante).
  3. Cliccare su **Approva** (`status` -> `APPROVED`) o **Rifiuta**.
- Approvando l'oggetto, questo diventa visibile nel catalogo (`app/routes/catalogue.tsx` filtra già per `status: "APPROVED"`).
- (Opzionale) Inviare un'email automatica o notifica all'utente quando l'oggetto viene approvato.

### Step 4: Chat e Notifiche Email
Quando un oggetto di un terzo viene prenotato (Step 2 crea la request), il terzo deve gestire l'approvazione della prenotazione e la chat.
Attualmente le chat (tabella `Message`) sono collegate a `Request`. Servirà assicurarsi che il "Proprietario" riceva le email al posto (o assieme) agli Admin di Material Matters, o che abbia una sua inbox dedicata simile a `/admin/inbox`.
