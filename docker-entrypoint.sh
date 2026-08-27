#!/bin/sh
#
# Cosa succede fra «il container parte» e «l'applicazione serve».
#
# Esiste per una sola ragione: **con il rilascio automatico al push, nessuno
# è lì ad applicare le migrazioni a mano**. Prima il rilascio era un gesto
# umano — `git pull`, `docker compose up -d --build` — e le migrazioni erano
# un altro gesto umano accanto. Ora il gesto umano è `git push`, e da lì in
# poi non c'è più nessuno: se le migrazioni non stanno qui dentro, un commit
# che tocca `schema.prisma` manda online il codice nuovo contro il database
# vecchio, e il primo che apre il catalogo trova un errore.
#
# `set -e` è la parte che conta: se `migrate deploy` fallisce si esce, il
# container non arriva mai a servire, il controllo di salute non passa e
# Coolify tiene su la versione precedente. Un database a metà strada è molto
# peggio di un rilascio che non parte.
set -e

# `migrate deploy` e non `migrate dev`: applica solo le migrazioni già
# scritte e non ne inventa nessuna, non chiede niente, non azzera niente.
# È l'unico comando di Prisma che si possa lasciare girare da solo.
#
# Legge `DATABASE_URL` dall'ambiente attraverso `prisma.config.ts` — dal
# Prisma 7 l'URL non sta più nel blocco `datasource` dello schema, ed è il
# motivo per cui quel file viene copiato nell'immagine finale.
node_modules/.bin/prisma migrate deploy

# `exec` e non una chiamata normale: così il server **prende il posto** di
# questa shell invece di restarle figlio, e riceve direttamente i segnali di
# Docker. Senza, un `docker stop` parlerebbe alla shell, che non li inoltra:
# dieci secondi di attesa e poi il server ammazzato di netto a ogni rilascio.
exec node_modules/.bin/react-router-serve ./build/server/index.js
