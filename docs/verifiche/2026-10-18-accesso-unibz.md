# Invito email unibz e verifica Microsoft — 18 ottobre 2026

La modifica locale aggiunge un suggerimento sotto il campo email di
`/signin`, nelle tre lingue, associato con `aria-describedby`. Nessun filtro
sul dominio e nessuna modifica ai metodi di autenticazione.

Verificati il controllo dei tipi e delle traduzioni, la build di produzione
e la schermata nel browser a larghezza telefono, in inglese e italiano.

## Prova sul sito pubblico

- `https://fabulabz.com/signin` porta a `https://fabula.bz/signin`.
- La pagina pubblica non mostra il pulsante Microsoft.
- Una richiesta a `POST /api/auth/sign-in/social` su `https://fabula.bz`,
  con provider `microsoft`, origine corretta e `disableRedirect: true`,
  restituisce HTTP 404 e `PROVIDER_NOT_FOUND` (`Provider not found`).
- Il provider non è attivo nell'istanza pubblica. Non è stato possibile
  provare il passaggio a Microsoft, il ritorno o la creazione della sessione.
- Coolify non è raggiungibile all'indirizzo configurato dalla connessione.
  Non è stato possibile verificare quali variabili manchino in produzione.
- In locale risultano presenti client ID, segreto e tenant; il pulsante
  compare. Questo non verifica validità, scadenza o configurazione pubblica.

Per riprendere la prova occorre accedere alla configurazione di produzione,
verificare le credenziali Microsoft e l'URI di ritorno del dominio attuale,
quindi completare un accesso con un account universitario.
