---
name: prisma-migration
description: Crea e applica una migrazione Prisma per Fabula quando `prisma migrate dev` si rifiuta di partire perché l'ambiente non è interattivo (errore "Prisma Migrate has detected that the environment is non-interactive"). Usa questa skill ogni volta che serve modificare prisma/schema.prisma e applicare il cambiamento al database — non lanciare `prisma migrate dev` direttamente in questo ambiente, fallirà sempre.
---

# Migrazione Prisma in un ambiente non interattivo

`prisma migrate dev` chiede sempre conferma quando rileva un cambiamento che
potrebbe perdere dati (anche solo un vincolo `UNIQUE` nuovo su una tabella
vuota) — e in un ambiente senza terminale interattivo quella conferma non
può arrivare mai, quindi il comando fallisce e basta, anche per modifiche
del tutto sicure. Questo percorso ottiene lo stesso risultato senza mai
passare da lì.

Tutti i comandi vanno lanciati da dentro `fabula/`.

## Passaggi

1. **Modifica `prisma/schema.prisma`** con il cambiamento voluto.

2. **Genera l'SQL della differenza**, confrontando il database già connesso
   (non i file di migrazione — evita di dover configurare uno shadow
   database) con lo schema appena modificato:

   ```bash
   pnpm exec prisma migrate diff \
     --from-config-datasource \
     --to-schema prisma/schema.prisma \
     --script > /tmp/migration-diff.sql
   ```

   Leggi `/tmp/migration-diff.sql` prima di andare avanti: deve contenere
   solo il cambiamento che ti aspetti. Se sembra voler cancellare o
   modificare qualcosa di non richiesto, fermati e capisci perché prima di
   applicarlo.

3. **Crea a mano la cartella della migrazione**, con lo stesso formato nome
   delle altre già in `prisma/migrations/` (timestamp UTC
   `yyyyMMddHHmmss` + underscore + un nome breve):

   ```bash
   TS=$(date -u +%Y%m%d%H%M%S)
   DIR="prisma/migrations/${TS}_nome_breve_del_cambiamento"
   mkdir -p "$DIR"
   cp /tmp/migration-diff.sql "$DIR/migration.sql"
   ```

4. **Applica e registra la migrazione**, senza prompt:

   ```bash
   pnpm exec prisma migrate deploy
   ```

5. **Rigenera il client**:

   ```bash
   pnpm db:generate
   ```

6. **Riavvia il server di sviluppo** se è già in esecuzione. Tiene in
   memoria il client Prisma vecchio e continua a dire che un campo o un
   modello non esiste anche dopo la rigenerazione — è una trappola già
   documentata in `fabula/CLAUDE.md`.

## Se `prisma migrate dev` è già stato tentato per sbaglio

Anche quando fallisce per il motivo non-interattivo, spesso crea comunque
una cartella di migrazione **vuota** (senza `migration.sql`) prima di
arrendersi. Vanno trovate e tolte di mezzo, altrimenti sporcano la
cronologia:

```bash
find prisma/migrations -type d -empty
```

Se una di queste cartelle vuote risulta già **applicata** nel database
(`prisma migrate status` la segnala, o compare in `_prisma_migrations` con
un nome senza file corrispondente sul disco), va tolta anche da lì prima di
cancellare la cartella — altrimenti Prisma continua a segnalare una
migrazione "applicata" che non esiste più:

```sql
DELETE FROM _prisma_migrations WHERE migration_name = 'nome_della_cartella_vuota';
```

(via `docker exec` su `psql`, o con un piccolo script Prisma se preferisci
restare in TypeScript — vedi come le altre migrazioni di Fabula sono state
verificate, con uno script `scripts-*.ts` temporaneo alla radice di
`fabula/`, cancellato subito dopo l'uso.)
