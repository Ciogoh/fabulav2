# Fabula

Il catalogo condiviso dell'associazione MaMa: chiunque vede cosa c'è e quando è
libero, i soci lo prenotano, gli admin decidono.

Interfaccia in inglese, italiano e tedesco. I nomi degli oggetti restano nella
lingua in cui sono stati scritti.

## Partire da zero

Servono Node 20+, pnpm e Docker.

```bash
pnpm install
cp .env.example .env      # poi riempi i valori
pnpm db:up                # PostgreSQL nel container
pnpm db:migrate           # crea le tabelle
pnpm db:seed              # dati di esempio
pnpm dev                  # http://localhost:5173
```

Per `SESSION_SECRET` genera una chiave con `openssl rand -base64 32`.

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

## Come è fatto

```
app/
  routes/catalogue.tsx      il catalogo pubblico — la pagina principale
  routes/language.tsx       cambio lingua (scrive il cookie)
  lib/availability.server   il motore di disponibilità
  lib/db.server             il client del database
  lib/use-cart              il carrello, prima dell'accesso
  i18n/dictionaries         le tre lingue, con controllo dei tipi
  components/               intestazione e badge di stato
prisma/schema.prisma        le nove tabelle
```

Tre punti fermi, se ci metti mano:

1. **Gli stati non si salvano.** Libero, Prenotato e In uso si calcolano dalle
   prenotazioni attive (`lib/availability.server`). Aggiungere un campo `stato`
   sugli oggetti significa creare un dato che prima o poi mentirà.

2. **I kit non entrano nella disponibilità.** Sono una scorciatoia del catalogo:
   si sciolgono nei loro pezzi dentro al carrello. Se ti trovi a interrogare
   `Kit` per capire se qualcosa è libero, stai sbagliando strada.

3. **Le quantità sono escluse di proposito.** Dieci sedie identiche sono dieci
   oggetti. Vedi la specifica per il perché.

## Traduzioni

Le chiavi stanno in `app/i18n/dictionaries.ts`. L'inglese è la lingua di
riferimento: definisce le chiavi, e se ne manca una in italiano o in tedesco
`pnpm typecheck` fallisce. Non serve nessuna libreria.

## Accesso

Tre modi di entrare, tutti sullo stesso account: **codice via email** (il
principale), **password**, **Google**. Apple è escluso: costa 99 € l'anno.

La regola che tiene l'accesso a una schermata sola: **con il codice non esiste
la differenza fra registrarsi ed entrare.** Scrivi l'indirizzo, ricevi il
codice, sei dentro — e se l'account non c'era, si crea da solo. Di conseguenza
**con la password si può solo entrare, mai registrarsi**: un account nasce
sempre da un codice o da Google, e la password si aggiunge dopo.

In sviluppo, senza `RESEND_API_KEY`, **il codice viene stampato nel terminale**
invece di essere spedito. Si può provare tutto senza configurare niente.

Ogni action che scrive deve cominciare con `requireUser` o `requireAdmin`
(`app/lib/session.server.ts`). Nascondere un pulsante non protegge niente.

## Cosa manca ancora

Invio delle richieste, calendario condiviso con esportazione iCal, pannello
admin, promemoria di riconsegna, caricamento delle foto. E l'aspetto: va
allineato al sito dell'associazione (monocromatico, accento rosso, carattere
Mattone) invece della palette blu attuale.
