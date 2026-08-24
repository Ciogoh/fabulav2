# Piano 2 — Il numero di versione e l'archivio dei piani

## Contesto

Due bisogni emersi parlando, diversi ma che si tengono per mano.

**I piani vivono fuori dal progetto.** Sono cinque, tutti di Fabula, e stanno
in `~/.claude/plans/` — cartella a livello utente, globale per tutto il Mac.
Conseguenze: fuori da git, fuori da `scripts/backup.sh`, invisibili a chiunque
apra il repo, e con nomi generati a caso (`attach-lively-bentley`,
`rosy-seeking-kazoo`) che fra sei mesi non dicono niente. Nel frattempo
`fabula/.claude/` — agenti, skill, impostazioni — è già versionato: il
materiale di Claude che appartiene al progetto ha già un posto, e i piani non
ci sono finiti.

**Non c'è modo di dire cosa sta girando.** `package.json` non ha nemmeno il
campo `version` (verificato), non esiste un CHANGELOG, non c'è un tag git: 26
commit e nessun modo di dire «questa è la 0.6» né di sapere se il server ha
già una correzione.

Il legame fra i due: **il piano dice cosa vogliamo fare, il changelog dice cosa
è uscito, la versione dice quando.** Sono tre pezzi della stessa storia, e oggi
il primo è fuori dal repo e gli altri due non esistono.

---

## Parte A — I piani entrano nel repo

Nuova cartella `fabula/docs/piani/`, dentro al progetto, quindi versionata,
nel backup e leggibile da chiunque apra Fabula.

I cinque file si spostano e si rinominano per **data e contenuto**, che è
l'unica cosa che serve quando li cerchi:

| Da `~/.claude/plans/` | A `fabula/docs/piani/` |
| --- | --- |
| `ho-visto-che-hai-fluttering-shannon.md` | `2026-08-22-badge-catalogo.md` |
| `cached-rolling-elephant.md` | `2026-08-22-promemoria-e-brainstorm.md` |
| `attach-lively-bentley.md` | `2026-08-24-intestazione-mobile.md` |
| `ok-e-secondo-te-whimsical-hinton.md` | `2026-08-24-registro-storico-qr.md` |
| `rosy-seeking-kazoo.md` (questo) | si spezza in due, vedi la nota sopra |

Più `docs/piani/README.md`: l'indice, due righe per piano — titolo, data, e se
è **fatto**, **in corso** o **da fare**. È lì che si legge la storia del
progetto in trenta secondi.

Una riga in `CLAUDE.md` (nel capitolo *A che punto siamo*) e una in
`README.md` che dicono dove sono e a cosa servono.

**Il limite, dichiarato:** Claude Code continuerà a scrivere i piani *nuovi* in
`~/.claude/plans/` col nome generato. Il travaso resta un gesto manuale di fine
sessione di pianificazione — piccolo, ma va ricordato, quindi finisce anche lui
nella riga di `CLAUDE.md`.

---

## Parte B — La versione

### Il principio: due mestieri, due meccanismi

Un numero di versione qui fa due lavori diversi, e tenerli separati è tutta la
progettazione:

1. **«Cosa sta girando davvero?»** — vuole dati **esatti e automatici**:
   commit e data di costruzione. Un numero scritto a mano qui mente il primo
   giorno che ci si dimentica di alzarlo.
2. **«Quanto è cresciuta?»** — è un **giudizio**, non un conteggio. Ventisei
   commit dentro cui stanno un refuso e tutto il sistema del QR non raccontano
   niente. Vuole un numero deciso a mano e una riga scritta.

Il contatore automatico puro (`git rev-list --count`) sembra risolverli
entrambi e non risolve il secondo. Si fanno tutti e due i pezzi.

### B1 — Il numero deciso a mano

`package.json` guadagna `"version": "0.5.0"`. **Scelta presa: 0.5.0 adesso,
`1.0.0` il giorno in cui Fabula viene consegnata davvero ai soci** — cioè dopo
il rebrand e la PWA. Il numero ha così una destinazione invece di crescere a
caso, e «quanto manca alla 1.0» diventa una domanda con una risposta.

Il significato locale, da scrivere in `CLAUDE.md` perché il semver da libreria
qui non si applica (Fabula ha un'installazione sola e nessuno che dipenda da
lei):

- **MINOR** (0.5 → 0.6): una capacità nuova che si vede usando — la PWA, il
  registro admin, il QR.
- **PATCH** (0.5.0 → 0.5.1): correzioni e rifiniture.
- **MAJOR**: la 1.0 è la consegna. Dopo, solo ciò che obbliga qualcuno a
  cambiare abitudine.

### B2 — `CHANGELOG.md`

Il posto dove la crescita si **vede**, ed è la parte che risponde davvero alla
tua domanda. Una sezione per versione, in italiano, con la data, scritta come
si scrive tutto in questo progetto: **il perché, non solo il cosa**. Le voci si
raggruppano in «Aggiunto / Cambiato / Corretto».

La 0.5.0 nasce già scritta, ricostruita dal capitolo *A che punto siamo* di
`CLAUDE.md` e dai 26 commit: è la fotografia di dove siamo.

### B3 — I dati esatti, senza nessuna variabile d'ambiente

Tre valori, tutti letti **da soli** al momento della costruzione. Niente da
impostare, niente da ricordare: si continua a costruire con
`docker compose --profile full up -d --build`, esattamente come oggi.

- **`0.5.0`** — da `package.json`, deciso a mano. Dice *cosa*.
- **`build 27`** — `git rev-list --count HEAD`, il numero di commit. **Sale da
  solo a ogni commit**, senza che nessuno ci pensi mai.
- **`2026-08-24`** — la data della costruzione.

Riga finita: **`Fabula 0.5.0 · build 27 · 2026-08-24`**.

**Perché prima sembrava complicato.** `.dockerignore` esclude `.git`, quindi
dentro al container non c'era niente da leggere e servivano argomenti di
costruzione da passare a mano — cioè un gesto in più da ricordare ogni volta,
che è esattamente il genere di cosa che si dimentica. Ma `.git` pesa **2,3 MB**
su un contesto di **5,7 MB** (misurato, non stimato): smettere di escluderlo
costa niente e fa sparire il problema. Due righe in tutto:

- `.dockerignore`: via `.git`, sostituendo il commento con quello nuovo che
  dice perché adesso ci serve;
- `Dockerfile`, **solo nello stadio di costruzione**:
  `RUN apk add --no-cache git`. Quello stadio viene buttato via — l'immagine
  finale copia solo `build` e `node_modules` — quindi non pesa un byte in più.

**`app/lib/version.ts`** (nuovo) — un posto solo, come `person.ts` per i nomi:
espone i tre valori e una `versionLabel()` che compone la riga.

**`vite.config.ts`** — un `define` con i tre valori, ognuno dentro un `try` che
ripiega su `"?"` se git non risponde. **La costruzione non deve mai fallire per
colpa del numero di versione**: è decorazione, non una funzione.

**`app/globals.d.ts`** (nuovo) — le tre `declare const`. Non ci sono `.d.ts`
nel progetto e `tsconfig.json` include `**/*`, quindi viene raccolto da solo.

Da preferire a un `import` di `package.json` (che `resolveJsonModule` renderebbe
possibile): il `define` diventa una stringa letterale nel bundle, l'import ci
spedirebbe dentro tutto l'elenco delle dipendenze.

**Una cosa da sapere su `build 27`:** sale anche per un refuso. È un'impronta
digitale — «il server ha questo codice qui» — non una misura di merito. Il
racconto di cosa è cresciuto sta nel `CHANGELOG.md`, e il giudizio sta nel
`0.5.0`. I due numeri fanno mestieri diversi apposta.

### B4 — Dove si vede

**Scelta presa: per ora solo nell'area admin**, perché Fabula non ha nessun piè
di pagina (zero occorrenze) e disegnarne uno adesso significa rifarlo col
rebrand.

- In fondo a **`/admin/log`**, che è già la pagina «cosa è successo».
- Nell'**`ErrorBoundary`** di `root.tsx`, in piccolo sotto al messaggio: quando
  qualcosa si rompe, sapere quale versione l'ha fatto vale più che altrove.

La riga è `Fabula 0.5.0 · build 27 · 2026-08-24`, **senza etichetta**: niente da
tradurre in tre lingue, e si legge uguale in tutte.

Quando arriverà il piè di pagina vero col rebrand, spostarla è una riga —
`versionLabel()` è già un posto solo.

### B5 — Il rito che tiene insieme i tre pezzi

Quando un piano di `docs/piani/` è finito:

1. si alza il MINOR in `package.json`;
2. si scrive la sezione nel `CHANGELOG.md`;
3. si marca il piano come **fatto** nell'indice;
4. `git tag v0.6.0`.

Il tag non è decorazione: da lì `git describe` dà gratis «v0.6.0-3-gae38553»,
cioè «tre commit dopo la 0.6.0» — il contatore sotto controllo che cercavi,
senza doverlo mantenere.

---

## Cosa NON facciamo, e perché

- **Il semver da libreria.** MAJOR non significa «rottura di compatibilità»:
  non esiste nessuno che dipenda da Fabula. Significa «consegna». Scritto in
  `CLAUDE.md`, altrimenti fra un anno qualcuno applica la regola sbagliata.
- **Il numero di build automatico** come versione unica. Cresce senza dire
  niente.
- **L'alzata automatica della versione a ogni commit.** Toglierebbe il
  giudizio, che è l'unica cosa che rende il numero interessante.

---

## File toccati

| Nuovi | |
| --- | --- |
| `docs/piani/*.md` + `docs/piani/README.md` | i cinque piani e l'indice |
| `CHANGELOG.md` | la crescita, in italiano |
| `app/lib/version.ts` | `APP_VERSION`, `BUILD_NUMBER`, `BUILD_DATE`, `versionLabel()` |
| `app/globals.d.ts` | le `declare const` del `define` |

| Modificati | |
| --- | --- |
| `package.json` | `"version": "0.5.0"` |
| `vite.config.ts` | il `define` coi tre valori e il ripiego |
| `Dockerfile`, `.dockerignore` | `.git` entra nel contesto (2,3 MB), `git` nello stadio buttato via |
| `app/routes/admin.log.tsx` | la riga in fondo |
| `app/root.tsx` | la riga nell'`ErrorBoundary` |
| `CLAUDE.md`, `README.md` | il significato dei numeri, il rito, dove stanno i piani |

---

## Verifica

1. `pnpm typecheck` — le `declare const` viste, niente `any`.
2. `pnpm dev` → `/admin/log`: la riga dice `0.5.0`, il commit vero e la data di
   oggi. In sviluppo il commit arriva da `git`, che c'è.
3. Forzare un errore (un indirizzo inesistente): la versione compare anche
   nella schermata di errore.
4. **La prova che conta**, quella per cui questo pezzo di piano esiste:
   `docker compose --profile full up -d --build`, **senza passare niente**, e
   poi guardare `/admin/log`. Deve dire `build 27` e non `build ?`. È l'unico
   modo di sapere che `.git` entra davvero nel contesto e che `git` c'è nello
   stadio di costruzione.
5. `git tag v0.5.0 && git describe` → deve rispondere `v0.5.0`.
6. `docs/piani/README.md` letto da capo: i cinque piani ci sono, i titoli
   dicono di cosa parlano, gli stati sono giusti.
