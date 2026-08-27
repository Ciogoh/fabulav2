# Fabula in produzione: Coolify, tunnel Cloudflare, rilascio al push

Questo documento è la procedura per mettere in piedi la produzione da zero, e
per capirla quando qualcosa non torna. Il *perché* di ogni scelta sta accanto
alla scelta: fra un anno servirà quello, non l'elenco dei clic.

## Perché Coolify

Il rischio di Fabula non è il carico — cento e mille utenti sono la stessa
architettura — ma la **disponibilità**. Sul MacBook la piattaforma era offline
ogni volta che il coperchio si chiudeva, e il tunnel non poteva farci niente.

Il server Linux risolve quello. Coolify risolve il resto: rilascio al push,
log e variabili dal browser, backup del database programmati, controllo di
salute con notifica, ritorno alla versione precedente in un clic. Le
alternative o non aggiornano niente da sole (compose più Watchtower) o sono lo
stesso mestiere con meno strada alle spalle.

**Il prezzo, detto chiaro:** Coolify è un pezzo in più che va aggiornato, e
metà della configurazione vive nel suo database invece che nel repo. Si paga
in due modi, ed entrambi vanno rispettati: il `docker-compose.yml` resta
funzionante come via di fuga, e **Coolify stesso va nel backup**.

---

## 1. Il server

Linux con IP dedicato, Docker installato, poi:

```
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**Firewall: solo la 22.** Non si aprono la 80 e la 443, perché il traffico
pubblico non entra da lì: entra dal tunnel, che è una connessione *in uscita*
verso Cloudflare. Un server senza porte in ascolto è un server che non si può
attaccare da fuori, ed è il motivo per cui il tunnel vale la complicazione in
più. La dashboard di Coolify (8000) si raggiunge da Tailscale o da un tunnel
suo, mai da internet aperto.

## 2. La sorgente

Coolify → Sources → **GitHub App** sul repo `Ciogoh/fabulav2`.

Va usata la GitHub App e non una chiave di deploy: è quella che installa il
webhook di push, cioè la parte che fa succedere il rilascio da sola. Con una
chiave sola si può clonare, ma bisogna premere «Deploy» a mano — che è
esattamente la fatica che si sta togliendo.

## 3. Le tre risorse

Un progetto `Fabula`, ambiente `production`. Tre risorse che si parlano sulla
rete interna del progetto, e **nessuna porta esposta sull'host**.

### a) Postgres

Risorsa Database → PostgreSQL 17. Niente porta pubblica.

Backup programmati dall'interfaccia: ogni notte, ritenzione 30 giorni,
destinazione **fuori dal server**. Un backup sulla stessa macchina non è un
backup. Questo sostituisce la metà «database» di `scripts/backup.sh`; la metà
«foto» resta da coprire (vedi in fondo).

### b) `fabula` — applicazione

Build pack **Dockerfile**, ramo `main`, porta esposta **3000**.

- **Nessun dominio pubblico assegnato.** Ci pensa il tunnel: se si assegna un
  dominio qui, Coolify prova anche a emettere un certificato Let's Encrypt
  sulla 80, che è chiusa, e il rilascio si impantana su quello.
- **Controllo di salute: `GET /healthz`.** Interroga davvero il database
  (`SELECT 1`), quindi distingue «processo vivo» da «piattaforma viva» — che è
  la distinzione che conta: un Node in piedi con Postgres irraggiungibile, per
  chi usa Fabula, è indistinguibile da tutto spento.
- **Storage persistente: un volume montato su `/app/data/uploads`.**
  **Da creare prima del primo rilascio.** È dove `UPLOAD_ROOT` scrive le foto
  degli oggetti e dei profili; senza volume vivono dentro al container, e ogni
  push le cancella tutte. È l'errore più costoso possibile qui, perché non dà
  nessun segnale finché qualcuno non cerca una foto che non c'è più.
- **Variabili**: tutte quelle del `.env` tranne `DATABASE_URL` (la collega
  Coolify alla risorsa Postgres), i `POSTGRES_*` e `APP_PORT`, che non
  servono più. `APP_URL` è il dominio pubblico vero.
- **Deploy on push** attivo su `main`.

### c) `cloudflared` — servizio

Immagine `cloudflare/cloudflared:latest`, comando:

```
tunnel --no-autoupdate run --token $CLOUDFLARE_TUNNEL_TOKEN
```

Sulla rete del progetto. In Cloudflare Zero Trust → Networks → Tunnels → il
tunnel → Public Hostname, il servizio punta a **`http://fabula:3000`**: il
nome del container, non `localhost`. Da qui viene il fatto che nessuna porta
resti esposta sull'host, e la sparizione della vecchia trappola
«`APP_PORT` deve combaciare col Service» — non ci sono più due numeri da
tenere allineati, ce n'è uno solo.

---

## 4. Cosa succede a ogni `git push`

1. GitHub avvisa Coolify.
2. Coolify clona (profondità 1) e costruisce il `Dockerfile`, passando lo sha
   come `SOURCE_COMMIT` — è quello che finisce nella riga di versione, visto
   che con un clone così il conteggio dei commit direbbe `1` per sempre.
3. Parte il container nuovo. `docker-entrypoint.sh` esegue
   `prisma migrate deploy` **prima** di servire.
4. Se le migrazioni falliscono il container esce, `/healthz` non risponde mai,
   e **il vecchio resta su**. È il comportamento voluto: un database a metà
   strada è peggio di un rilascio che non parte.
5. Se `/healthz` risponde, il traffico passa al nuovo.

**Conseguenza pratica, la regola da ricordare:** una migrazione va committata
insieme al codice che la richiede. Spingere uno schema cambiato senza la sua
migrazione manda in produzione codice che parla a tabelle che non esistono.

## 5. Migrazione dei dati dal Mac

```
pg_dump ... | gzip > fabula.sql.gz
tar czf uploads.tar.gz data/uploads
```

Ripristino del dump dalla console della risorsa Postgres, foto scompattate nel
volume persistente. Poi si controlla che nei log del rilascio compaia
`No pending migrations to apply.`

**Lo stack sul Mac si spegne solo dopo la verifica**, non prima: finché il
tunnel non è commutato non c'è fretta, e due copie accese sono due copie che
scrivono sullo stesso mondo.

## 6. Cosa resta da salvare

Coolify copre il database. Restano due cose:

- **Le foto** (`/app/data/uploads`): la metà di `scripts/backup.sh` che
  Coolify non fa. Va tenuta, puntata al volume del server.
- **Coolify stesso**: la sua configurazione — variabili, risorse, collegamenti
  — vive nel suo database, non nel repo. Senza quel backup, rimettere in piedi
  tutto significa rifare i clic a memoria.

E la regola di sempre: **un backup mai ripristinato è una speranza.** Il primo
ripristino di prova si fa subito, non il giorno in cui serve.
