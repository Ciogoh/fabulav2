# Fabula — l'immagine di produzione.
#
# **L'ordine delle righe qui sotto non è estetico.** Docker riusa una riga solo
# se tutto ciò che sta sopra è rimasto identico, quindi i manifesti vanno
# copiati **da soli, prima del sorgente**: le dipendenze dipendono solo da
# loro, e finché non cambiano l'installazione non si rifà.
#
# Com'era prima — `COPY . /app` e poi `pnpm install` — bastava toccare una
# riga di interfaccia per invalidare l'installazione e ripagare mezzo giga di
# dipendenze, `sharp` nativo compreso. Misurato: 48 secondi per cambiare un
# commento. Se un giorno queste righe vanno riordinate, questa è la ragione
# per cui stanno così.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# Due installazioni separate e non una con potatura: quella completa serve a
# costruire (c'è dentro Vite), quella `--prod` è ciò che gira in produzione.
# Tenerle in due stadi vuol dire che l'immagine finale non vede mai le
# dipendenze di sviluppo, e che le due si riusano dalla cache separatamente.
#
# `pnpm-workspace.yaml` va copiato anche qui: contiene gli `allowBuilds` per
# Prisma, e senza pnpm si rifiuta di eseguire i suoi script di installazione.
FROM base AS dev-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS build-env
# `git` serve solo a leggere il numero di commit per la riga di versione (vedi
# `versionStamp` in `vite.config.ts`). Sta **qui e non in `base`**: l'immagine
# finale parte da `base`, quindi installarlo lì lo spedirebbe in produzione per
# niente. Questo stadio invece viene buttato via — ne sopravvivono solo
# `build/`. Prima di ogni `COPY`, così resta nella cache e non si riscarica.
RUN apk add --no-cache git

# I manifesti servono anche qui, e non per scrupolo: `pnpm exec` fa scattare
# un controllo automatico delle dipendenze, e senza `package.json` accanto a
# `node_modules` quel controllo conclude che non è installato niente e prova a
# reinstallare — fallendo con `ERR_PNPM_NO_PKG_MANIFEST`. È la stessa trappola
# che sul comando di avvio ci ha già messo un container in crash-loop.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=dev-deps /app/node_modules ./node_modules

# Lo schema prima del resto del sorgente: `prisma generate` dipende solo da
# lui, quindi il client non si rigenera a ogni riga di interfaccia toccata.
COPY prisma ./prisma
COPY prisma.config.ts ./
# `prisma generate` non si collega a nessun database, ma `prisma.config.ts`
# legge `DATABASE_URL` e senza esploderebbe. Un valore finto basta, ed è ciò
# che permette di tenere il `.env` vero fuori dal contesto di costruzione.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN pnpm exec prisma generate

COPY . .

# Lo sha del commit, per la riga di versione quando `.git` non basta.
#
# `versionStamp` conta i commit con `git rev-list --count HEAD`, che vuole la
# storia intera. Coolify però clona in profondità 1: il conteggio darebbe `1`
# **senza errore**, quindi in silenzio, per sempre. Coolify passa da sé un
# argomento di costruzione `SOURCE_COMMIT`; quando c'è, vince lui.
# Vuoto in locale, dove `.git` c'è davvero e il conteggio è quello giusto.
ARG SOURCE_COMMIT=""
ENV SOURCE_COMMIT=$SOURCE_COMMIT

RUN pnpm run build

FROM base
ENV NODE_ENV=production

# `curl` serve al controllo di salute, e sta **qui** e non in uno stadio
# buttato via: è l'unico che finisce davvero in produzione.
#
# Chi controlla la salute non è dentro all'applicazione ma fuori, e per
# chiedere `/healthz` deve avere qualcosa con cui chiedere. `node:24-alpine`
# non ha `curl`, e il `wget` di BusyBox risolve `localhost` sull'indirizzo
# IPv6 `::1` mentre il server ascolta solo su IPv4: «Connection refused» a
# ogni tentativo, con l'applicazione perfettamente sana dietro. Il primo
# rilascio è morto esattamente così.
RUN apk add --no-cache curl
COPY package.json pnpm-lock.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
# Il client Prisma non si copia: `vite build` lo incorpora dentro a
# `build/server/index.js`. Verificato — nel bundle non resta nessun import
# verso `app/generated`.
COPY --from=build-env /app/build ./build

# Lo schema, le migrazioni e la configurazione di Prisma arrivano fin qui
# **anche se l'applicazione non ne ha bisogno per servire**: servono a
# `prisma migrate deploy`, che l'avvio esegue prima di ogni altra cosa (vedi
# `docker-entrypoint.sh` per il perché). La CLI `prisma` c'è già: sta fra le
# dipendenze di produzione, non fra quelle di sviluppo.
#
# `prisma.config.ts` non è facoltativo: dal Prisma 7 il blocco `datasource`
# dello schema non contiene più l'URL, che vive lì dentro. È anche il motivo
# per cui `dotenv` sta fra le dipendenze di produzione — quel file lo importa.
# Senza `.env` nell'immagine non fa niente, e `DATABASE_URL` arriva
# dall'ambiente vero iniettato da chi avvia il container.
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./

# `react-router-serve` direttamente e non `pnpm run start`: quel giro fa
# scattare un controllo automatico delle dipendenze che, senza
# `pnpm-workspace.yaml` nell'immagine finale, fallisce e mette il container in
# crash-loop. La riga vera è in fondo all'entrypoint.
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
