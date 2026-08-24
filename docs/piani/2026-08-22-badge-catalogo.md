# Il badge del catalogo risponde a «adesso», non al ciclo di vita

## Contesto

Nel catalogo un oggetto libero oggi ma prenotato fra qualche giorno mostra un
badge **arancione «Prenotato»**. Chi guarda la griglia legge quella parola e
quel colore come «non ce l'hai», e passa oltre — mentre l'oggetto è sullo
scaffale e oggi si prende senza problemi.

Il difetto non è la parola: è che il badge risponde a due domande diverse con
lo stesso segnale. Chi sfoglia il catalogo si chiede **«lo prendo adesso?»**;
il badge invece racconta **a che punto del ciclo di vita è l'oggetto**.

E `RESERVED` oggi collassa due realtà opposte
([availability.server.ts:140](../../Documents/LIB/02_WORK/MaMa_Rent_Platform/fabula/app/lib/availability.server.ts)):

| Caso | `from` | Realtà oggi |
| --- | --- | --- |
| prenotazione futura | valorizzato | **libero** |
| prenotazione iniziata, non ancora ritirato | `null` | **non libero** |

Stessa parola, stesso arancione, risposta contraria. Quello è il difetto vero.

**Esito voluto:** sul catalogo il colore torna a significare una cosa sola —
disponibilità adesso — e la prenotazione futura scende di un livello, da badge
a riga piccola in `--muted`.

```
[ LIBERO ]  Prenotato 28 ago – 31 ago    ← verde: oggi lo prendi
[ IN USO ]  Torna il 27 ago              ← rosso: oggi no
[ LIBERO ]                               ← verde: niente in vista
```

Decisioni prese con l'utente:

- **«In uso» copre entrambi i casi occupati** (ritirato e in attesa di ritiro).
  Nessuna chiave nuova per l'etichetta, e la riga piccola resta «Torna il X»
  in tutti e due: con la stessa etichetta e la stessa data di rientro, un
  «Ritiro oggi» non aggiungerebbe niente di azionabile al pubblico.
- **La prenotazione futura si annuncia solo entro 14 giorni.** I prestiti
  ordinari durano al massimo 7 giorni: una prenotazione di dicembre vista ad
  agosto è rumore. Chi pianifica lontano ha la scheda oggetto e il calendario.

**Fuori perimetro:** l'arancione `--held` resta com'è sul calendario
([calendar.tsx:419](../../Documents/LIB/02_WORK/MaMa_Rent_Platform/fabula/app/routes/calendar.tsx))
e in `request-detail.tsx`. Lì c'è un asse dei giorni, quindi la barra arancione
è appoggiata sul giorno a cui si riferisce e non può essere letta come
«adesso». È proprio l'asse del tempo che manca a una scheda del catalogo.

## Come

Il motore non si tocca: gli stati restano tre e continuano a calcolarsi
(regola 1 intatta). Cambia solo **come `StateBadge` li presenta**.

### 1. `app/lib/availability.shared.ts` — la soglia

Aggiungere accanto ai due tetti di durata:

```ts
/** Fin dove una prenotazione futura vale una riga in catalogo. Oltre, la
 *  scheda dice solo «Libero»: i prestiti ordinari durano al massimo
 *  MAX_ORDINARY_SPAN_DAYS, quindi una prenotazione fra mesi è rumore. */
export const UPCOMING_NOTE_DAYS = 14;

/** `from` e `today` sono giorni interi a mezzanotte UTC. */
export function isUpcomingSoon(from: Date | string, today: string): boolean;
```

Sta qui e non in `availability.server.ts` per la ragione già scritta in cima al
file: quello importa il database, e `StateBadge` gira nel browser.

### 2. `app/components/state-badge.tsx` — la mappatura

Il componente riceve lo stato **di dominio** e ne calcola uno **visivo**:

| Ingresso | Badge | Riga piccola |
| --- | --- | --- |
| `FREE` | `FREE` | — |
| `RESERVED` con `from` futuro, entro 14 gg | `FREE` | `state.bookedRange` |
| `RESERVED` con `from` futuro, oltre 14 gg | `FREE` | — |
| `RESERVED` senza `from` (iniziata, non ritirata) | `IN_USE` | `state.backOn` |
| `IN_USE` | `IN_USE` | `state.backOn` |
| `NOT_BOOKABLE`, `UNAVAILABLE` | invariati | invariati |

- Nuova prop obbligatoria **`today: string`** (`"YYYY-MM-DD"`). Non usare
  `new Date()` dentro al componente: «oggi» sul server e «oggi» nel browser
  possono non coincidere e React se ne accorge in idratazione. Entrambe le
  rotte hanno già `today` nel loader.
- `STYLES` e `LABELS` diventano mappe sugli stati **visivi**: `text-held
  bg-held-bg` esce da questo file. `BadgeState` in ingresso non cambia.
- Aggiornare il blocco di testa: oggi spiega quattro casi, e la ragione nuova
  (il colore dice disponibilità, non ciclo di vita) va scritta lì.

`UNAVAILABLE` non ha più nessun produttore da quando i campi data sono usciti
dal catalogo. Lasciarlo dov'è — la rotta risorsa `availability.tsx` potrebbe
riprenderlo — ma non è vivo.

### 3. Le due chiamate

Passare `today={today}`, già presente in `loaderData` in entrambe:

- [catalogue.tsx:380](../../Documents/LIB/02_WORK/MaMa_Rent_Platform/fabula/app/routes/catalogue.tsx)
  — `today` va aggiunto alle prop di `AssetCard`, che oggi non lo riceve.
- [item.tsx:131](../../Documents/LIB/02_WORK/MaMa_Rent_Platform/fabula/app/routes/item.tsx)
  — è già nello scope del componente.

Anche i due `<StateBadge state="NOT_BOOKABLE" />` prendono `today` se la prop
è obbligatoria (più semplice che renderla opzionale).

### 4. `app/i18n/dictionaries.ts` — una chiave sola

```
"state.bookedRange"   EN "Booked {start} – {end}"
                      IT "Prenotato {start} – {end}"
                      DE "Reserviert {start} – {end}"
```

Le date si formattano con `useFormatDay` (giorno + mese abbreviato, senza
anno). `pnpm typecheck` fallisce se manca in una delle tre lingue.

### 5. `prisma/seed.ts` — il commento mente e manca un caso

- Il commento della richiesta a `day(6)` dice «→ badge "Prenotato"»: da
  correggere in «libero oggi, con la riga della prenotazione».
- Aggiungere una richiesta **approvata, iniziata, non ritirata** (es.
  `day(-1)` → `day(2)`, `pickedUpAt` assente): è esattamente il caso che questa
  modifica riclassifica, e oggi non esiste nei dati di esempio, quindi non si
  può verificare senza toccare il database a mano.

### 6. `fabula/CLAUDE.md`

Due punti diventano falsi:

- «Catalogo pubblico … con i tre stati (Libero / Prenotato / In uso)» — il
  catalogo ne mostra due, il terzo vive nel motore e sul calendario.
- Regola 7, ultimo punto: «`StateBadge`, quattro casi» — vanno riscritti come
  stato di dominio in ingresso e stato visivo in uscita, con la ragione (il
  colore dice disponibilità; l'arancione funziona dove c'è un asse dei giorni).

## Verifica

```bash
pnpm typecheck
```

Poi, con i dati di esempio rigenerati:

```bash
pnpm db:reset && pnpm db:seed && pnpm dev
```

Sul catalogo, i tre casi che il seed produce:

1. **Proiettore Epson / Telo di proiezione** (richiesta `day(-2)` → `day(3)`,
   ritirati) → `[ IN USO ] Torna il …`, rosso.
2. **I pezzi del kit** (richiesta `day(6)` → `day(9)`, approvata, non
   ritirata) → `[ LIBERO ] Prenotato … – …`, **verde**. Prima erano arancioni:
   è il caso da cui nasce tutto.
3. **La richiesta nuova del punto 5** (iniziata, non ritirata) →
   `[ IN USO ] Torna il …`, rosso.
4. Un oggetto senza prenotazioni → `[ LIBERO ]` e basta.
5. Videocamera Sony / Treppiede (richiesta `PENDING`) → `[ LIBERO ]` nudo: le
   richieste in attesa non bloccano e non si annunciano.

Aprire la scheda di uno del punto 2 (`/items/…`): stesso badge verde, e
l'elenco «Prese» sotto continua a mostrare la prenotazione per esteso — è lì
che sta il dettaglio completo.

Da controllare anche:

- **Tema scuro**, che è dove i colori di stato hanno già ingannato una volta.
- **375px di larghezza**: badge e riga piccola stanno su due righe dentro alla
  scheda senza far scorrere la pagina in orizzontale.
- **Orizzonte**: spostare a mano la richiesta del kit oltre i 14 giorni
  (`pnpm db:studio`) e verificare che la riga piccola sparisca lasciando
  `[ LIBERO ]` nudo.
