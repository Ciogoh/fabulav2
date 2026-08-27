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

---

## Com'è configurato oggi (27 agosto 2026)

Questo capitolo è la fotografia di ciò che gira davvero, con gli uuid veri.
Serve a chi apre il pannello fra un anno e non sa da dove cominciare.

**Server:** `46.18.29.105`, Coolify 4.3.12, team `mama`, progetto `fabula`,
ambiente `production`.

| Risorsa | uuid | Cos'è |
|---|---|---|
| `fabula` | `12uhtrtkqbsybdrlwkpymtva` | l'applicazione, costruita dal `Dockerfile` sul ramo `main` |
| `fabula-postgres` | `oyqmluvhzjh1dh26hsurkrfy` | il database; è anche il suo nome di rete |
| `cloudflared` | `ouuimrk4mjueyea9nwdzhzgf` | il connettore del tunnel, `network_mode: host` |

**Il percorso di una richiesta**, che è la cosa da avere in testa:

```
chi visita fabulabz.com
  → Cloudflare            (TLS, il certificato è suo)
  → cloudflared           (tunnel in uscita: nessuna porta aperta sul server)
  → http://localhost:80
  → coolify-proxy         (Traefik: legge Host(`fabulabz.com`))
  → il container di Fabula sulla porta 3000
  → fabula-postgres
```

**Perché il tunnel punta al proxy e non al container.** Sembra un giro
inutile e non lo è: il container si chiama `<uuid>-<timestamp>` e **quel nome
cambia a ogni rilascio**. Puntandogli direttamente, Cloudflare andrebbe
riconfigurato a ogni push. Traefik invece lo ritrova dall'intestazione `Host`,
quindi la rotta del tunnel — `http://localhost:80` — si scrive una volta sola.
È anche il motivo per cui aggiungere un secondo servizio sullo stesso tunnel
costa solo un dominio scritto in Coolify.

Il dominio dell'applicazione è dichiarato **`http://`** e non `https://`: il
TLS lo fa Cloudflare al bordo. Con `https` Coolify proverebbe a emettere un
certificato Let's Encrypt sulla porta 80, che è chiusa nel firewall, e il
rilascio resterebbe impantanato lì.

### Tailscale non c'entra col pubblico

`tailscaled` serve la dashboard di Coolify sull'indirizzo `100.96.78.78`, e
**non sta nel percorso pubblico**: spegnendolo, Fabula continua a funzionare e
si perde solo l'amministrazione. È la ragione per cui la 8000 non deve stare
su internet aperto.

---

## Le tre trappole trovate mettendoci le mani

Sono scritte qui perché ognuna è costata tempo, e nessuna si annuncia da sé.

### 1. Il proxy spento è un sito giù senza nessun segnale

Al primo tentativo il tunnel rispondeva **502** qualunque indirizzo gli si
desse. La causa non era l'indirizzo: **`coolify-proxy` era `exited`**, quindi
su `localhost:80` non c'era nessuno. Fabula era `running:healthy`, il tunnel
aveva quattro connessioni registrate, e il sito era irraggiungibile.

**Da qui la regola: davanti a un 502, guardare il proxy prima dell'indirizzo.**

```
Servers → il server → Proxy       (dev'essere «running»)
```

Ed è il motivo per cui le notifiche di Coolify non sono un vezzo: questo
guasto non lo vede nessuno finché non scrive un socio.

### 2. Tailscale e Traefik si contendono la 443

Il proxy non partiva perché `tailscaled` teneva la 443 sul proprio indirizzo, e
Traefik la chiede su `0.0.0.0` — che quell'indirizzo lo include. L'errore che
si vede in Coolify è `Port 443 is in use`, ma solo provando ad avviare il proxy
**a mano dall'interfaccia**: da fuori il sintomo è quello della trappola 1.

**Risolto alla radice, il 27 agosto 2026**, disattivando Tailscale Serve sulla
443. Il proxy è tornato alla configurazione standard di Coolify — `80`, `443`,
`443/udp`, `8080` — e non c'è nessuna modifica a mano che un aggiornamento
possa cancellare.

Per un attimo si era rimediato togliendo la 443 dalla configurazione del
proxy: funzionava, perché in questo schema il TLS lo fa Cloudflare e il tunnel
entra dalla 80. Ma era una modifica fuori standard che viveva nel database di
Coolify, cioè una mina innescata al primo aggiornamento che rigenerasse quel
file. **Se un giorno il proxy dovesse tornare a non partire per la 443, la
strada giusta è di nuovo questa: liberare la porta, non toglierla a Traefik.**

Per il seguito, la configurazione del proxy si rilegge e si riscrive così —
l'endpoint è `PUT`, non `PATCH`, e un `PATCH` risponde `Not found`, il che
sembra un problema di permessi e non lo è:

```
GET  /api/v1/servers/{uuid}/proxy
PUT  /api/v1/servers/{uuid}/proxy/configuration    {"configuration": "<base64>"}
```

### 3. Il controllo di salute ha bisogno di `curl`, e `localhost` non basta

`node:24-alpine` non ha `curl`; il `wget` di BusyBox risolve `localhost` su
IPv6 `::1` mentre il server ascolta su IPv4, e risponde «Connection refused»
con l'applicazione perfettamente sana. Per questo il `Dockerfile` installa
`curl` nell'immagine finale e il controllo punta a **`127.0.0.1`**, non a
`localhost`.
