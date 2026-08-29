# Due selettori: lo stile visivo e il tema

## Contesto

Esiste una proposta di stile nuovo per Fabula — la variante **1b «Magenta
protagonista»** dell'artifact *Nuova piattaforma design system* — molto
distante da com'è la piattaforma adesso: caratteri VG5000 + Departure Mono,
magenta e arancio pieni, spigoli vivi, bordi spessi, intestazione e piè di
pagina a fascia colorata.

Non si vuole sostituire l'aspetto attuale, si vuole **poterlo scegliere**:
lo stile di adesso resta quello predefinito, il nuovo si accende da un
selettore rapido. E, nella stessa passata, il selettore chiaro/scuro — oggi
un menu a tendina sepolto in `/account` — va portato in cima, piccolo.

**La buona notizia, e il motivo per cui è fattibile in mezza giornata:** il
progetto è già costruito per questo senza saperlo. Zero colori scritti a mano
nei componenti (`grep` di esadecimali in `app/**/*.tsx`: due, entrambi
giustificati), tutti i token in `app/app.css` con `light-dark()`, e un file
solo per il pulsante, il guscio di pagina, il badge di stato e
l'intestazione. Cambiare pelle è quasi solo scrivere un secondo elenco di
valori.

**La conseguenza che regge tutto il piano:** React non deve mai sapere quale
stile è attivo — nemmeno per i glifi di stato, che diventano `content` in CSS.
Lo stile è noto in JavaScript **solo dentro al suo selettore**. Nessun hook
nuovo da infilare in venti componenti, nessun `if (skin === …)` sparso.

Scelte già prese con Samu:

- ambizione **pelle + telaio**: colori, caratteri, spigoli, *più* intestazione
  a fascia, piè di pagina, pulsanti in maiuscoletto mono, glifi nuovi. Fuori
  restano le fasce piene a tutta larghezza con dentro titolo e filtri;
- bordi **2px**, con un'eccezione CSS dichiarata e confinata;
- tema chiaro/scuro **in cima accanto alla lingua**, come pulsante che cicla;
  stile **nel menu del profilo**.

---

## Architettura: `data-skin`, gemello esatto di `data-theme`

Non si inventa niente: si ricalca il meccanismo del tema, che è già la
risposta giusta alla stessa domanda (preferenza del dispositivo, letta dal
server, dentro all'HTML prima che la pagina parta, funzionante senza
JavaScript).

| | tema | stile |
| --- | --- | --- |
| valori | `auto` · `light` · `dark` | `classic` · `riso` |
| predefinito | `auto` = **assenza** di attributo | `classic` = **assenza** di attributo |
| dove vive | cookie `theme` | cookie `skin` |
| chi lo legge | `root.tsx` loader → `<html data-theme>` | `root.tsx` loader → `<html data-skin>` |

L'assenza come predefinito non è pigrizia, è la regola già scritta in
`app.css`: «`auto` non mette nessun attributo, o sarebbe un terzo caso da
tenere allineato». Vale identica per `classic`.

**File nuovi**, tutti copie ravvicinate di quelli del tema:

- `app/lib/skin.ts` — `SKINS`, `type Skin`, `isSkin()` (calco di `lib/theme.ts`)
- `app/lib/skin.server.ts` — cookie, un anno, `SameSite=Lax` (calco di `lib/theme.server.ts`)
- `app/routes/skin.tsx` — `action` con `redirectTo` filtrato: deve cominciare
  per `/` e non per `//`, **la regola dell'open redirect di `CLAUDE.md`**
  (calco di `routes/theme.tsx`)
- riga in `app/routes.ts` accanto a quella di `theme`

---

## Passo 1 — sbloccare i due valori che Tailwind inchioda

Prima di poter cambiare pelle, due proprietà vanno rese variabili. **Nessuna
delle due cambia un pixel dello stile classico.**

### 1a. Gli spigoli — `rounded` → `rounded-sm`

`rounded` nudo compila a `border-radius: 0.25rem` **letterale**: in Tailwind 4
sta nel blocco `@theme default inline reference`, che inlinea il valore invece
di emettere una variabile. `rounded-sm` compila invece a
`border-radius: var(--radius-sm)`, e `--radius-sm` vale `0.25rem`: **stesso
identico risultato, ma sovrascrivibile.**

Sostituzione meccanica in `app/**/*.tsx` (80 + 3 occorrenze):

- `rounded` → `rounded-sm` (confine di parola, **non** seguito da `-`)
- `rounded-t` `rounded-r` `rounded-l` → `rounded-t-sm` ecc.
- `rounded-full` (18 volte: avatar, pastiglie, pallini) **non si tocca** —
  nel mockup i cerchi restano cerchi.

`field` e `field-area` in `app.css` usano già `var(--radius-sm)`: si girano
gratis.

### 1b. I bordi — l'eccezione dichiarata

`border` compila a `border-width: 1px` fisso, in 90 punti. Il mockup vive di
2px. Sei righe dentro al blocco dello stile nuovo in `app.css`, una per lato:

```css
/* L'eccezione, e l'unica. Tailwind non tokenizza lo spessore dei bordi:
   `border` è `1px` letterale. Il tratto spesso però è metà del carattere di
   questo stile, e riscrivere 90 classi per uno stile alternativo sarebbe
   pagare in tutto il progetto una cosa che serve qui. Le regole stanno
   dentro a `[data-skin="riso"]`, quindi non esistono per chi non l'ha
   scelto, e `:where()` tiene la specificità a zero sulle classi. */
:root[data-skin="riso"] :where(.border)   { border-width: var(--rule-width) }
:root[data-skin="riso"] :where(.border-t) { border-top-width: var(--rule-width) }
/* …r, b, l, x, y */
```

`--rule-width` vale `1px` nello stile classico (dove nessuna regola lo legge)
e `2px` in quello nuovo.

---

## Passo 2 — lo stile «riso»

### I caratteri

I due file sono **già in mano**: stanno dentro al bundle dell'artifact, e li
si estrae da
`~/.claude/projects/…/tool-results/artifact-3894305f-1787999728-182e.html`
(script `type="__bundler/manifest"`, valori base64):

- `cb47bc66-…` → VG5000, `font/woff`, 31 KB
- `d663b4a9-…` → Departure Mono, `font/woff2`, 14 KB

Entrambi OFL, quindi ospitabili da noi. Vanno in **`app/fonts/`** e non in
`public/fonts/`, e la ragione è concreta: da `app/` Vite li firma con
l'impronta del contenuto e li mette sotto `/assets/*`, che è **l'unico
percorso che il service worker ha il permesso di mettere in cache** (vedi
*Sicurezza* in `CLAUDE.md`). Da `public/` uscirebbero a `/fonts/*`,
scaricati a ogni visita.

I `@font-face` si dichiarano **sempre**, senza condizioni: un carattere
dichiarato ma non usato da nessun testo non viene mai scaricato. Chi resta
sullo stile classico non paga un byte.

> **Punto aperto da chiudere prima di finire.** Il VG5000 del bundle è **solo
> peso 400 e solo woff**, mentre l'interfaccia usa `font-medium` (500) e
> `font-semibold` (600) in decine di punti: il browser li sintetizzerebbe, e
> il finto grassetto su un carattere così caratterizzato si vede. Vanno presi
> i pesi veri da velvetyne.fr (OFL) e convertiti in woff2. Departure Mono è
> monopeso per disegno: lì va bene così.

### I colori

Un blocco `:root[data-skin="riso"]` in `app.css` che ridichiara **gli stessi
token di adesso**, ognuno con `light-dark(chiaro, scuro)` come impone la
regola del file. I valori vengono dal mockup:

| | chiaro | scuro |
| --- | --- | --- |
| `--paper` | `#FFF6E8` | `#100A04` |
| `--card` | `#FFFFFF` | `#1D140C` |
| `--ink` | `#2B0016` | `#F6EDE0` |
| `--muted` | `#7A5C68` | `#C2AE94` |
| `--rule` | `#2B0016` | `#31261A` |
| `--accent` | `#C4005E` | `#FF7FB2` |
| `--on-accent` | `#FFFFFF` | `#100A04` |

**Sul magenta va detta una cosa.** Il mockup riempie i pulsanti di `#E00069`,
che su bianco fa 4,81:1 — passa, ma su `#FFF6E8` scende a 4,49:1, cioè sotto
AA per un soffio. Il designer se n'era già accorto e per il testo usa
`#C4005E`. Prendendo `#C4005E` come `--accent` unico si tiene **un token che
fa un mestiere solo** (regola 1 del file): 5,99:1 come testo su bianco, 5,59:1
su carta, e bianco sopra il pieno 5,99:1. Un filo più profondo del mockup,
stessa famiglia, nessuna eccezione da ricordare.

Chi scrive questi valori **ricalcola i rapporti e li annota accanto**, come
sono annotati oggi: è la disciplina che tiene in piedi il file.

Gli stati (`--free`, `--held`, `--out`, `--idle` e le versioni `-solid`)
prendono i loro valori dal mockup senza introdurre tinte nuove — nel riso
cambiano riempimento e glifo, non colore. **`--accent` non entra mai in uno
stato**, che è la difesa già in piedi per quando il rosso del marchio si
scontrerà col rosso «occupato».

### Il logo

`components/logo.tsx` ha `const BRAND = "#ec008c"` e ha già `tone="current"`.
Diventa `fill={tone === "brand" ? "var(--brand)" : "currentColor"}`, con
`--brand` fra i token: `#ec008c` nel classico, `#FFAC00` nel riso — che è
esattamente il colore del logo dentro al mockup 1b, arancio sulla fascia
magenta.

`scripts/icons.ts` **non si tocca**: l'icona installata è congelata al momento
dell'installazione e non può seguire una preferenza del dispositivo. Resta
magenta, e resta il primo colore da rivedere col rebrand vero.

---

## Passo 3 — il telaio

Quattro cose che i token da soli non fanno. Tutte in file già centralizzati.

**L'intestazione** (`components/site-header.tsx`). Cinque token nuovi —
`--chrome-bg`, `--chrome-ink`, `--chrome-muted`, `--chrome-rule` — che nel
classico valgono `--card`/`--ink`/`--muted`/`--rule` (nessun cambiamento
visibile) e nel riso diventano la fascia magenta con testo bianco. Le classi
del file passano da `bg-card` a `bg-chrome`, sei righe. La variante admin
continua a usare `--admin-bg`/`--admin-rule`, che nel riso prendono i loro
valori.

**Il piè di pagina**, che oggi non esiste. `components/site-footer.tsx`
nuovo, montato in `root.tsx` sotto all'`<Outlet>` e nell'`ErrorBoundary`:
la riga «Fabula è un progetto di MaMa · unibz · Bolzano» più `versionLabel()`.
`CLAUDE.md` lo dà già per previsto («il piè di pagina vero non esiste ancora:
quando arriverà col rebrand, spostarla è una riga»).

**I pulsanti** (`components/button.tsx`). Un'`@utility btn` in `app.css` che
legge `--btn-font`, `--btn-weight`, `--btn-tracking`, `--btn-case`; nel
classico sono i valori di adesso, nel riso diventano mono, maiuscoletto,
`0.08em`. In `button.tsx` cambia **una riga**: `btn` entra nella base di
`buttonClass()`.

**I glifi di stato** (`components/state-badge.tsx`). Il riso usa
`■ ◔ ▨ ⌀` invece di `● ▪ ◇`. Invece di una tabella condizionata sullo stile,
lo `<span aria-hidden>` prende `data-state={visual}` e il glifo diventa
`content: var(--glyph)` in CSS, con un `--glyph` per stato e per stile. **È
questo che toglie del tutto il bisogno di sapere lo stile dentro a React.**

---

## Passo 4 — il selettore di stile, nel menu del profilo

In `ProfileMenu` (`site-header.tsx`), sotto a «Profilo» e sopra a «Esci»: una
riga per stile, `Classico` e `Riso`, con `aria-current` su quello attivo —
la stessa fattura delle voci di `LanguageMenu`, stesso `fetcher.Form` verso
`/skin`, stesso `redirectTo` con `location.pathname + location.search`.
Funziona senza JavaScript per la stessa ragione per cui funziona la lingua.

Lo stile compare **anche** nella sezione «Aspetto» di `/account`, accanto al
tema, con la stessa `<Select>` che c'è già: è il posto dove si va a cercare
una preferenza quando non si sa che esiste una scorciatoia.

---

## Passo 5 — il tema, in cima, come pulsante che cicla

Nel gruppo `ml-auto` di `SiteHeader`, **prima** di `LanguageMenu`: un
`<fetcher.Form method="post" action="/theme">` con un solo `<button>` da
44×44 che manda il valore successivo del ciclo `auto → light → dark → auto`.
Icona sole / luna / mezzaluna secondo lo stato **attuale**, `aria-label` che
dice dove si va (`t("nav.themeNext", { theme: … })`), e la scelta che sta
viaggiando si accende subito da `fetcher.formData` — come fa già la lingua.

Un modulo e un pulsante, quindi anche qui **niente JavaScript richiesto**.

Il costo dichiarato: da `auto` a `dark` servono due tocchi, e non si vede in
anticipo dove si sta andando. È la scelta fatta, in cambio del controllo più
piccolo possibile.

La sezione «Aspetto» di `/account` **resta** com'è: lì i tre stati si vedono
per nome, ed è dove finisce chi non ha capito l'iconcina.

### Il colore della barra di sistema

`root.tsx` ha oggi `#ffffff`/`#161b24` scritti a mano nei `<meta
name="theme-color">`, presi da `--card`. Con il telaio colorato la barra deve
seguire `--chrome-bg`, quindi diventa una tabellina a quattro voci
(stile × tema) accanto al resto del `Layout`. Il commento che spiega perché
con `auto` le righe sono due e con una scelta esplicita una sola resta valido
e va tenuto.

Il `manifest.webmanifest` non si tocca: i suoi colori valgono per la finestra
dell'app installata, che non può seguire una preferenza per dispositivo.

---

## Traduzioni

Chiavi nuove in inglese, italiano e tedesco insieme — `pnpm typecheck`
fallisce se ne manca una (regola 5). **Usare la skill `add-i18n-key`.**

- `nav.themeNext` (l'`aria-label` del pulsante che cicla)
- `nav.skin`, `account.skin`, `account.skinClassic`, `account.skinRiso`,
  `account.skinIntro`
- `footer.credit`

---

## Verifica

Non basta che compili: si guarda.

1. `pnpm dev`, poi il preview del browser su `http://localhost:5173`.
2. **Le quattro combinazioni** — classico/chiaro, classico/scuro,
   riso/chiaro, riso/scuro — su tre schermate che coprono i casi diversi:
   il **catalogo** (badge pieni, griglia, carrello), il **dettaglio di una
   richiesta** (chat, azioni admin, campi), il **Centro** (elenchi fitti,
   pastiglie). Screenshot di ciascuna.
3. **Il classico non deve essere cambiato di un pixel.** È il controllo che
   conta più di tutti: la sostituzione `rounded` → `rounded-sm` e i token di
   telaio sono no-op per disegno, e se qualcosa si muove lì è un errore.
   Confronto a schermo prima/dopo sul catalogo.
4. `resize_window` a 375px: intestazione con il pulsante del tema in più —
   verificare che non torni a due righe — e il piè di pagina nuovo.
5. `read_console_messages` per errori, e la scheda rete per controllare che
   **col tema classico i due file di carattere nuovi non vengano scaricati**.
6. Il selettore **senza JavaScript** (DevTools → disabilita JS): premere una
   voce di stile deve ricaricare e cambiare pelle lo stesso.
7. `pnpm typecheck` e `pnpm test`.

---

## Alla fine, il rito già scritto

1. MINOR in `package.json` — è una capacità nuova che si vede usando;
2. sezione in `CHANGELOG.md`, col **perché**;
3. in `fabula/CLAUDE.md`: un paragrafo in *Aspetto* su come si aggiunge uno
   stile (il blocco `[data-skin]`, l'eccezione dei bordi, la regola che React
   non conosce lo stile), e la riga del piè di pagina in *Versione*, che ora
   esiste davvero;
4. spostare questo file in `fabula/docs/piani/2026-08-29-selettore-stile.md`
   con la riga nell'indice.

---

## Cosa resta fuori, dichiarato

- **Le fasce piene a tutta larghezza** con dentro titolo e filtri, come nel
  catalogo del mockup. Richiedono di insegnare il full-bleed a `PageShell` e
  di rivedere `PageTitle` e la testata del catalogo: è il pezzo che tocca le
  rotte, e va fatto dopo aver visto il resto in piedi.
- **Il rebrand vero a Material Matters** (monocromatico + rosso, carattere
  Mattone). Questo piano non lo fa e non lo blocca: aggiunge il binario su cui
  farlo viaggiare. Quando arriverà, sarà un terzo blocco `[data-skin]`, non
  una riscrittura.
- **I pesi veri di VG5000** — vedi il punto aperto nel Passo 2.
