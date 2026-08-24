# Fabula

Il catalogo condiviso dell'associazione MaMa (Material Matters, mamabz.com,
Bolzano): chiunque vede cosa c'è e quando è libero, chi ha un account lo
richiede indicando le date, gli admin approvano e registrano ritiro e
riconsegna.

Interfaccia in inglese, italiano e tedesco. I nomi degli oggetti restano nella
lingua in cui sono stati scritti.

Per lo stato dettagliato del progetto, le regole architetturali da non
rompere, il capitolo sicurezza e le trappole già incontrate, vedi
[`CLAUDE.md`](./CLAUDE.md) — è la guida che usa anche Claude Code per
lavorare su questo progetto, tenuta aggiornata a ogni cambiamento.

## Partire da zero

Servono Node 20+, pnpm e Docker.

```bash
pnpm setup    # installa, crea .env, genera SESSION_SECRET, avvia il database,
              # applica le migrazioni e carica i dati di esempio
pnpm dev      # http://localhost:5173
```

`pnpm setup` (`scripts/setup.sh`) è rieseguibile senza pericolo: se il `.env`
esiste già non lo tocca e salta il seed, che altrimenti cancellerebbe i dati
presenti. I passi equivalenti a mano, utili per capire cosa fa o per rifarne
uno solo:

```bash
pnpm install
cp .env.example .env      # poi riempi i valori
pnpm db:up                # PostgreSQL nel container
pnpm db:migrate           # crea le tabelle
pnpm db:seed              # dati di esempio
```

Per `SESSION_SECRET` genera una chiave con `openssl rand -base64 32`
(`pnpm setup` lo fa da solo).

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `pnpm dev` | Server di sviluppo con ricarica automatica |
| `pnpm typecheck` | Controllo dei tipi (include le traduzioni mancanti) |
| `pnpm build` | Build di produzione |
| `pnpm db:up` / `pnpm db:down` | Avvia e ferma PostgreSQL |
| `pnpm db:migrate` | Crea e applica una migrazione dopo aver toccato lo schema |
| `pnpm db:seed` | Ricarica i dati di esempio |
| `pnpm db:studio` | Sfoglia il database in una pagina web |
| `pnpm db:reset` | Svuota tutto e riparte (distruttivo) |

## Cosa fa oggi

Il ciclo intero funziona, dal catalogo alla riconsegna:

- **Catalogo pubblico** senza account, con ricerca e stato calcolato in tempo
  reale (Libero / Prenotato / In uso), kit che si sciolgono nei loro pezzi nel
  carrello, calendario condiviso con esportazione iCal pubblica.
- **Richiesta**: le date si scelgono al momento di premere «Richiedi», non in
  cima al catalogo. Fino a sette giorni; oltre, una richiesta speciale con
  motivo. Il carrello manda a `/requests`, che ricontrolla tutto lato server.
- **Dettaglio di una richiesta** (`/requests/:id`): chi l'ha fatta modifica le
  date o annulla e chatta con l'admin; l'admin approva, rifiuta, segna ritiro
  e riconsegna oggetto per oggetto, scrive una nota interna, manda un
  promemoria — che parte anche da solo, un giorno prima della scadenza.
- **Pannello admin**: oggetti (ricerca, filtro, gruppi per categoria,
  archiviazione), categorie, kit, coda di approvazione, soci (ruolo e reset
  password), registro di chi ha fatto cosa.
- **QR e consegna diretta**: ogni oggetto ha un'etichetta QR da stampare;
  inquadrandola col telefono o con la webcam si sceglie a chi darlo e fino a
  quando, e il prestito è registrato in un colpo — approvato e già ritirato.
  Lo scanner apre da solo la fotocamera giusta (la posteriore principale, non
  la grandangolare), e l'adesivo funziona anche con la fotocamera di sistema
  del telefono, senza passare da Fabula.
- **Accesso**: codice via email (il modo principale — non c'è differenza fra
  registrarsi ed entrare), password, Google, Microsoft. Foto caricabili per
  oggetti e profilo, con validazione del tipo reale del file.

Manca ancora l'allineamento visivo al sito dell'associazione (monocromatico,
accento rosso, carattere Mattone, invece della palette blu attuale), e come
passo successivo la PWA installabile. Dettagli in `CLAUDE.md`.

> **Per provare lo scanner dal telefono serve HTTPS**: la fotocamera nel
> browser non parte da un indirizzo IP di rete locale. Si passa dal tunnel
> Cloudflare che il progetto usa già.

## Come è fatto

```
app/
  routes/          pagine pubbliche, richieste, admin — vedi CLAUDE.md per l'elenco completo
  components/      button, page, cart-bar, state-badge... i pezzi condivisi
  lib/             motore di disponibilità, sessione, email, upload, notifiche
  i18n/            le tre lingue, con controllo dei tipi
prisma/schema.prisma  nove tabelle nostre + tre di Better Auth
```

Tre punti fermi, se ci metti mano (motivati per esteso in `CLAUDE.md`):

1. **Gli stati non si salvano.** Libero, Prenotato e In uso si calcolano dalle
   prenotazioni attive (`lib/availability.server.ts`). Aggiungere un campo
   `stato` sugli oggetti significa creare un dato che prima o poi mentirà.

2. **I kit non entrano nella disponibilità.** Sono una scorciatoia del
   catalogo: si sciolgono nei loro pezzi dentro al carrello. Se ti trovi a
   interrogare `Kit` per capire se qualcosa è libero, stai sbagliando strada.

3. **Le quantità sono escluse di proposito.** Dieci sedie identiche sono dieci
   oggetti. Vedi `CLAUDE.md` per il perché.

## Traduzioni

Le chiavi stanno in `app/i18n/dictionaries.ts`. L'inglese è la lingua di
riferimento: definisce le chiavi, e se ne manca una in italiano o in tedesco
`pnpm typecheck` fallisce. Non serve nessuna libreria — c'è anche una skill di
Claude Code dedicata (`.claude/skills/add-i18n-key`).

## Accesso

Quattro modi di entrare, tutti sullo stesso account: **codice via email** (il
principale), **password**, **Google**, **Microsoft** (pensato per chi ha un
account dell'università che ospita l'associazione — spento finché mancano le
chiavi nel `.env`).

La regola che tiene l'accesso a una schermata sola: **con il codice non esiste
la differenza fra registrarsi ed entrare.** Scrivi l'indirizzo, ricevi il
codice, sei dentro — e se l'account non c'era, si crea da solo. Di conseguenza
**con la password si può solo entrare, mai registrarsi**: un account nasce
sempre da un codice o da un provider esterno, e la password si aggiunge dopo,
da `/account` o da un link che un admin manda da `/admin/members`.

In sviluppo, senza `RESEND_API_KEY`, **il codice viene stampato nel terminale**
invece di essere spedito. Si può provare tutto senza configurare niente.

Ogni action che scrive deve cominciare con `requireUser` o `requireAdmin`
(`app/lib/session.server.ts`). Nascondere un pulsante non protegge niente.

## Versione e storia

In fondo a `/admin/log` c'è la riga che dice quale copia sta girando:

```
Fabula 0.5.0 · build 27 · 2026-08-24
```

`0.5.0` è deciso a mano e dice quanto è cresciuta la piattaforma — **la 1.0.0
è il giorno della consegna ai soci**. `build 27` è il numero di commit e sale
da solo: serve a rispondere a «ma il server ha già la correzione?».

- [`CHANGELOG.md`](./CHANGELOG.md) — cosa è cambiato a ogni versione, e perché.
- [`docs/piani/`](./docs/piani/) — i piani scritti prima di toccare il codice.
  Il codice dice com'è fatto, il piano dice perché è fatto così.

Il rito per alzare la versione sta nel capitolo *Versione* di
[`CLAUDE.md`](./CLAUDE.md).
