# Fabula — tre passi concreti: registro admin, storico oggetto, QR + consegna diretta

## Contesto

Dopo l'analisi della roadmap generale (vedi la discussione precedente), Samu ha
scelto di procedere passo per passo su tre voci concrete, in quest'ordine di
priorità:

1. **Registro delle azioni admin** — implementarlo ora.
2. **Storico visibile per oggetto** — implementarlo ora.
3. **QR univoco per oggetto + scanner per una consegna diretta e veloce** —
   valutarne la fattibilità (webcam/fotocamera telefono) e, se fattibile,
   progettarlo.

La PWA installabile è esplicitamente rimandata a un secondo momento ("quello
sarà uno step due") e **non fa parte di questo piano**.

Questo documento copre la progettazione tecnica di tutte e tre le voci — sono
comunque pensate per essere costruite e spedite una alla volta, non
necessariamente nella stessa sessione.

---

## 1. Registro delle azioni admin

### Perché così

Oggi solo l'approvazione/rifiuto di una richiesta ha un «chi» tracciato
(`Request.decidedById`/`decidedAt`). Ritiro, riconsegna, annullo da parte di
un admin, cambio di ruolo di un socio, invio di un link di reset non hanno
nessuno storico. Con più admin volontari che si alternano, questo è anche una
questione di responsabilità reciproca, non solo di sicurezza formale.

Scelgo uno schema **generico ma minimo**: una tabella sola, un campo `detail`
in testo libero invece di un JSON tipizzato per ogni azione — coerente con
come il resto del codice preferisce campi concreti a strutture generiche (vedi
`notifications.server.ts`, che costruisce testo invece di oggetti). `detail`
è scritto per intero al momento dell'azione (es. `"Proiettore Epson (20–25
ago)"`), così il registro resta leggibile anche se l'oggetto viene archiviato
o eliminato più tardi.

**Scope deliberatamente limitato in questa prima versione**: registro le
azioni che toccano fiducia o stato di un prestito — approva/rifiuta/annulla
una richiesta, ritiro/riconsegna, cambio ruolo socio, invio reset password,
archivia/elimina oggetto. **Non** registro modifiche di campo (nome di un
oggetto, descrizione, categorie/kit creati o rinominati) — sono reversibili,
a basso rischio, e aggiungerle ora sarebbe rumore prima ancora di sapere se
serve. L'helper generalizza facilmente se in futuro si vuole estendere.

### Schema

Nuovo modello in `prisma/schema.prisma`, vicino a `Request`:

```prisma
model AdminAction {
  id         String   @id @default(cuid())
  actorId    String
  actor      User     @relation(fields: [actorId], references: [id], onDelete: Cascade)
  action     String   // "request.approve" | "request.reject" | "request.cancel" |
                       // "requestItem.pickup" | "requestItem.return" |
                       // "member.roleChanged" | "member.resetSent" |
                       // "asset.archived" | "asset.deleted" | "asset.handover"
  targetType String   // "Request" | "RequestItem" | "User" | "Asset"
  targetId   String
  detail     String?  // testo pronto per la riga del registro
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([createdAt])
}
```

Aggiungere `adminActions AdminAction[]` alla relazione su `User`. Migrazione
con la skill `prisma-migration` (non `prisma migrate dev` diretto, fallisce in
questo ambiente non interattivo — vedi la trappola già annotata in
`CLAUDE.md`).

### Helper

`app/lib/audit.server.ts`, una funzione sola:

```ts
export async function logAdminAction(params: {
  actorId: string;
  action: string;
  targetType: "Request" | "RequestItem" | "User" | "Asset";
  targetId: string;
  detail?: string;
}): Promise<void> {
  await db.adminAction.create({ data: params });
}
```

Nessun `try/catch` interno: se scrivere il log fallisce, chi chiama decide —
stesso principio già usato per le email in `notifications.server.ts`, ma qui
la scrittura è sullo stesso database della transazione principale, quindi in
pratica non dovrebbe mai fallire da sola.

### Punti di chiamata

- `app/routes/request-detail.tsx`, dentro ai rami `approve`/`reject` (dopo
  l'`update`), `cancel` (solo quando `isAdmin && !isOwner`, il ramo che già
  distingue questo caso per la notifica), `pickup`/`return`.
- `app/routes/admin.members.tsx`, dentro a `toggleRole` e `sendReset`.
- `app/routes/admin.assets.$id.tsx`, dentro a `archive` e `delete`.
- La rotta di consegna diretta (punto 3 più sotto), che logga `asset.handover`.

### Pagina del registro

`app/routes/admin.log.tsx`, nuova, `requireAdmin`. Elenco delle ultime ~100
voci (niente paginazione in questa prima versione — il volume atteso per
un'associazione di volontari è basso; si aggiunge se e quando serve, non
prima). Ogni riga: `<Avatar>`/`<PersonName>` di chi ha agito (riuso
`components/person.tsx`), etichetta dell'azione tradotta, `detail`, orario
(stesso formato di `ChatSection` in `request-detail.tsx`,
`toLocaleString(lang, {...})`). Link alla voce del nav admin in
`site-header.tsx`, stesso pattern di `adminQueue`/`adminMembers`/`adminAssets`.

Nuove chiavi di traduzione (nav, intestazione pagina, etichette delle azioni)
da aggiungere con la skill `add-i18n-key`.

---

## 2. Storico visibile per oggetto

### Perché così

Nessuna tabella nuova: i dati ci sono già su `RequestItem` (`pickedUpAt`,
`returnedAt`) e `Request` (date, stato, richiedente). Serve solo una query in
più e una sezione nella pagina che l'admin già usa.

**Resta admin-only.** Il catalogo pubblico non deve mai mostrare chi ha avuto
un oggetto (regola di sicurezza già in `CLAUDE.md`: «Nessun nome di persona
nelle superfici pubbliche»). Questa sezione va nella pagina già protetta da
`requireAdmin`, non nella scheda pubblica (`item.tsx`).

### Dove

`app/routes/admin.assets.$id.tsx`: nel `loader`, accanto al `_count` già
presente, una query in più:

```ts
db.requestItem.findMany({
  where: { assetId: id },
  select: {
    pickedUpAt: true,
    returnedAt: true,
    request: {
      select: {
        id: true, startDate: true, endDate: true, status: true,
        user: { select: { name: true, firstName: true, lastName: true, alias: true } },
      },
    },
  },
  orderBy: { request: { startDate: "desc" } },
})
```

Nel componente, una sezione `<AssetHistory>` (sottocomponente nello stesso
file, coerente con come `admin.requests.tsx` e `request-detail.tsx`
organizzano già i loro sottocomponenti) fra il modulo dei campi e la
`ExitZone`: righe compatte con date, `<PersonName>`, stato tradotto
(`STATUS_LABELS` già esiste in `request-detail.tsx` — se conviene
condividerlo va estratto in un posto comune, es. `i18n/meta.ts` o un piccolo
`lib/request-status.ts`, invece di duplicarlo un'altra volta). Ogni riga linka
a `/requests/:id` per il dettaglio completo — niente altro da costruire lì,
la pagina esiste già.

---

## 3. QR per oggetto + scanner + consegna diretta

### Fattibilità (la domanda che Samu ha posto esplicitamente)

**Generare il QR: banale, nessun problema.** Ogni oggetto ha già un `id`
univoco; basta codificare un indirizzo stabile
(`${APP_URL}/admin/handover/{assetId}`) con il pacchetto `qrcode` (puro
JavaScript, nessuna dipendenza nativa, produce un'immagine PNG in formato
`data:` URL con `toDataURL()` — si mostra con un `<img>` normale, si salva o
si stampa da lì, nessuna infrastruttura in più).

**Leggere il QR con la fotocamera del telefono: fattibile, senza bisogno di
un'app nativa**, con un avvertimento pratico sul test, non sulla fattibilità:

- La pagina apre la fotocamera nel browser (`getUserMedia`) e decodifica i
  fotogrammi con una libreria JS pura — propongo `qr-scanner` (npm,
  leggera, usa `BarcodeDetector` dove il browser ce l'ha e un decoder proprio
  dove no, quindi funziona sia su Android Chrome sia su iOS Safari, che
  `BarcodeDetector` non lo supporta affatto).
- Serve un contesto sicuro (HTTPS, o `localhost`): soddisfatto in produzione
  dal tunnel Cloudflare già configurato. **In sviluppo locale, aprire il sito
  dal telefono via IP della rete locale non basta** — niente HTTPS, niente
  fotocamera. Per testare dal vivo durante lo sviluppo va usato lo stesso
  tunnel Cloudflare che il progetto usa già, non l'indirizzo IP del Mac.
- **Il simulatore iOS non ha una fotocamera vera**: la verifica finale va
  fatta su un telefono reale. Lo dico esplicitamente perché è l'unica parte
  di questo piano che non riesco a verificare da solo fino in fondo — la
  costruisco e la controllo per quanto posso (build, tipi, che la pagina
  carichi), ma la prova con la fotocamera la deve fare Samu su un telefono
  vero prima di dirla finita.

**Bonus non richiesto ma naturale**: siccome il QR codifica un indirizzo vero
e non solo l'ID nudo, funziona anche con la fotocamera di sistema del
telefono (quella di Foto/Camera, senza aprire Fabula) — la maggior parte dei
telefoni recenti la riconosce e offre di aprire il link. Lo scanner dentro
Fabula resta comunque quello richiesto, utile per restare dentro all'app senza
cambiare fotocamera durante un giro in magazzino.

**Un avvertimento di sicurezza da non saltare**: un adesivo QR su uno
scaffale è un oggetto fisico, sostituibile da chiunque ci abbia accesso. La
pagina che decodifica il QR **non deve fidarsi ciecamente del testo letto** e
navigare lì — stessa regola già in `CLAUDE.md` per i redirect che arrivano
dall'utente (`next`/`redirectTo`, deve iniziare per `/` e non per `//`). Qui
si applica così: il testo decodificato va validato come URL dello stesso
`origin` e con percorso che comincia per `/admin/handover/`, altrimenti
ignorato — mai una navigazione diretta al testo letto dalla fotocamera.

### Cosa succede quando si scansiona: consegna diretta

L'idea di Samu — scansiona, scegli la persona, scegli il periodo, consegna
subito — si traduce bene nel modello dati esistente **senza tabelle nuove**:
si crea una `Request` già `APPROVED` (con `decidedById`/`decidedAt` all'admin
che sta consegnando) con un solo `RequestItem` già `pickedUpAt: now()`. Da lì
in poi è una richiesta vera come tutte le altre — chat, riconsegna,
promemoria automatico funzionano già, senza una riga di codice in più,
perché non sono altro che una `Request`/`RequestItem` nello stato in cui una
richiesta normale arriva dopo tre passaggi invece che dopo uno.

**Decisioni di comportamento, esplicite invece che nascoste nel codice:**

- **Niente tetto dei 7 giorni né «richiesta speciale» con motivo obbligatorio
  per la consegna diretta.** Quella regola esiste per frenare l'autoservizio
  dei soci; qui l'admin ha la persona davanti e ha già deciso. Resta comunque
  il tetto assoluto `MAX_SPECIAL_SPAN_DAYS` e, soprattutto, **resta sempre il
  controllo di sovrapposizione** (`getBusyAssetIds`) — nessuna eccezione: un
  oggetto già impegnato in quelle date non si assegna due volte, a
  prescindere da chi lo sta facendo.
- **Un oggetto per scansione in questa prima versione**, non un carrello di
  più oggetti in una sessione di scanner — è quello che Samu ha descritto
  letteralmente («quell'oggetto»). Estendere a più oggetti in sequenza è
  un'aggiunta naturale più avanti se serve, non ora.
- **Il destinatario deve essere già un socio registrato** su Fabula (si
  cerca fra gli utenti esistenti) — creare un account al volo per chi non ce
  l'ha non è stato chiesto ed è fuori da questo piano.
- Email di conferma al destinatario dopo la consegna, riusando lo schema già
  in `notifications.server.ts` (nuova funzione `notifyDirectHandover`, sulla
  falsariga di `notifyRequesterDecision`).

### File nuovi

- `app/lib/qr.server.ts` — una funzione, genera il `data:` URL PNG a partire
  dall'id di un oggetto.
- `app/routes/admin.scan.tsx` — la pagina scanner: un pulsante «Avvia» (la
  fotocamera su iOS richiede un gesto dell'utente per partire), il tag
  `<video>`, `qr-scanner` che decodifica, validazione dell'URL come sopra,
  poi `navigate()` verso `/admin/handover/:assetId`. Ferma la fotocamera
  quando il componente si smonta.
- `app/routes/admin.handover.$assetId.tsx` — carica l'oggetto (404 se non
  esiste o è archiviato), un `<PersonPicker>` per scegliere il socio (stessa
  UI di ricerca+elenco di `AssetPicker` in `kit-fields.tsx`, ma a scelta
  singola invece che a caselle multiple), `DateRangeFields` riusato
  (`components/date-range-fields.tsx`) **senza** il ramo «richiesta
  speciale» — o con quel ramo semplicemente ignorato, da valutare in fase di
  scrittura se è più pulito passare una variante del componente o un flag.
  L'`action` crea `Request` + `RequestItem` nello stato descritto sopra,
  chiama `logAdminAction` (punto 1) e `notifyDirectHandover`.
- `app/components/person-picker.tsx` — estrae il pattern di ricerca+elenco di
  `AssetPicker`, a scelta singola, riusabile qui e potenzialmente altrove.

### Modifiche a file esistenti

- `app/routes/admin.assets.$id.tsx`: un `<img>` con il QR generato nel
  `loader` (via `qr.server.ts`), vicino alle foto o nella `ExitZone`.
- `app/components/site-header.tsx`: voce di navigazione admin «Scansiona»
  verso `/admin/scan`, stesso pattern delle altre voci admin.
- `package.json`: due dipendenze nuove, `qrcode` (generazione, server) e
  `qr-scanner` (lettura, client) — entrambe pure JS, nessun binario nativo,
  coerenti con l'assenza di `sharp`-style build step aggiuntivo in Docker.

---

## Ordine di lavoro consigliato

Punti 1 e 2 sono indipendenti fra loro e dal punto 3 — si possono costruire e
spedire subito, anche nella stessa sessione, in quest'ordine (il registro
prima, perché il punto 3 lo userà per loggare `asset.handover`). Il punto 3 è
il pezzo più corposo e vale la sessione a sé.

## Verifica

- Punti 1 e 2: `pnpm typecheck`, poi verifica dal vivo nel browser
  (`pnpm dev`) — crea/approva/ritira una richiesta di prova e controlla che
  compaia nel registro; apri la scheda di un oggetto già prestato e controlla
  che lo storico sia corretto.
- Punto 3: `pnpm typecheck` e verifica della pagina scanner in un browser
  desktop per gli aspetti che non serve un telefono per controllare (validazione
  dell'URL decodificato, il modulo di consegna, la creazione della richiesta).
  **La prova con la fotocamera vera** va fatta da Samu su un telefono, tramite
  il tunnel Cloudflare per avere HTTPS anche in sviluppo — è l'unico passo di
  verifica che non posso completare da solo.
