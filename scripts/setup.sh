#!/usr/bin/env bash
# Prepara l'ambiente di sviluppo da zero: strumenti, dipendenze, .env,
# database, dati di esempio. Pensato per il primo "git clone" su una
# macchina nuova — vedi "Partire da zero" in README.md.
#
# Rieseguibile senza pericolo: se il .env esiste già non lo tocca e salta il
# seed, perché prisma/seed.ts cancella i dati esistenti prima di ricrearli
# (vedi "pnpm db:reset" in CLAUDE.md — stessa cautela qui).

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Controllo strumenti richiesti"
for cmd in node pnpm docker; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Manca '$cmd' nel PATH. Installalo e riprova."
    exit 1
  }
done

node_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$node_major" -lt 20 ]; then
  echo "Serve Node 20 o più recente (trovato: $(node -v))."
  exit 1
fi

echo "==> Dipendenze (pnpm install)"
pnpm install

fresh_env=false
if [ ! -f .env ]; then
  echo "==> Creo .env da .env.example"
  cp .env.example .env
  secret="$(openssl rand -base64 32)"
  # -i.bak per compatibilità col sed di macOS, che a differenza di quello
  # GNU non accetta -i senza argomento.
  sed -i.bak "s#^SESSION_SECRET=.*#SESSION_SECRET=\"${secret}\"#" .env
  rm -f .env.bak
  fresh_env=true
  echo "    SESSION_SECRET generata automaticamente."
  echo "    Riempi gli altri valori (email, Google, Microsoft...) solo se ti servono — vedi i commenti in .env."
else
  echo "==> .env già presente, non lo tocco"
fi

echo "==> Avvio PostgreSQL (docker compose up -d db)"
docker compose up -d db

echo "==> Attendo che il database sia pronto"
pg_user="$(grep '^POSTGRES_USER=' .env | cut -d= -f2)"
ready=false
for _ in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U "$pg_user" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo "Il database non risponde dopo 30 secondi. Controlla 'docker compose logs db'."
  exit 1
fi

echo "==> Migrazioni (prisma migrate dev)"
pnpm db:migrate

if [ "$fresh_env" = true ]; then
  echo "==> Dati di esempio (prisma db seed)"
  pnpm db:seed
else
  echo "==> Salto il seed: il .env esisteva già, potrebbero esserci dati veri."
  echo "    Per ricaricare i dati di esempio (cancella quelli attuali): pnpm db:seed"
fi

echo ""
echo "Fatto. Avvia il server di sviluppo con:"
echo ""
echo "    pnpm dev"
echo "    http://localhost:5173"
