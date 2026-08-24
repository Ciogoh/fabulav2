# La foto del profilo si cambia premendo la foto

## Contesto

In `/account` (`app/routes/account.tsx`) la sezione della foto è oggi:

```
[ avatar 96px ]   FOTO
                  [ Scegli file ] Nessun file selezionato
                  JPEG, PNG o WebP, fino a 5 MB…
                  [ Togli la foto ]
```

L'avatar è solo un'immagine morta, e l'unico bersaglio premibile è il
controllo nativo del browser — testo grigio piccolo, fattura di un altro
mondo rispetto al resto dell'interfaccia (regola 7: *un pulsante solo, un
guscio solo*, che oggi questa schermata rompe). Chi arriva sulla pagina prova
a premere la foto, non succede niente, e il "Scegli file" lì accanto non si
legge come un pulsante.

**Risultato voluto:** si preme la foto — o il pulsante vero accanto — e si
sceglie l'immagine. Su telefono, dove il passaggio del mouse non esiste,
l'invito si deve vedere lo stesso, senza toccare niente.

Il modello è già in casa: `components/photo-picker.tsx` (le foto degli
oggetti) usa `<input class="peer sr-only">` fratello di una `<label>`, che
porta l'anello di fuoco della tastiera sull'elemento disegnato da noi. Qui si
applica la stessa idea a un avatar tondo.

## Cosa si costruisce

### 1. `AvatarPicker`, componente locale in `app/routes/account.tsx`

Vive in fondo al file accanto a `Field` — un solo punto d'uso, non merita un
file in `components/`.

Struttura (il `<label htmlFor>` funziona anche fuori dal modulo, quindi il
pulsante può stare nella colonna di destra mentre l'`<input>` resta dentro al
modulo della foto):

```
<photoFetcher.Form> (flex-wrap, items-center, gap-5)
  <input type="hidden" name="intent" value="photo">
  <input id="avatarPhoto" name="photo" type="file" class="peer sr-only">   ← fonte della verità
  <label htmlFor="avatarPhoto">  ← l'avatar, tondo, cursor-pointer
      <Avatar size="lg"> oppure l'anteprima locale
      badge fotocamera in basso a destra, SEMPRE visibile
      velo + scritta al passaggio del mouse / al fuoco
  </label>
  <div colonna>
     <label htmlFor="avatarPhoto" class={buttonClass("secondary")}>Cambia foto / Aggiungi una foto</label>
     <p hint>
  </div>
</photoFetcher.Form>
```

Dettagli che contano:

- **Il badge fotocamera è sempre visibile**, non solo in `hover`: sul telefono
  l'hover non esiste e sarebbe di nuovo un invito invisibile. Piccolo SVG
  scritto a mano, come in `components/select.tsx` e `site-header.tsx` — non
  si aggiunge una libreria di icone per una macchina fotografica.
- **Quando non c'è foto** il cerchio prende il bordo tratteggiato accento
  (`border-dashed border-rule hover:border-accent`), come il riquadro di
  `photo-picker.tsx`: si legge subito come un posto in cui mettere qualcosa.
- **L'anello di fuoco** sta sul cerchio, via
  `peer-focus-visible:outline peer-focus-visible:outline-2
  peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent` —
  l'`<input>` è `sr-only` e non `hidden`, quindi resta raggiungibile da
  tastiera e dentro al modulo.
- **Il pulsante secondario resta** accanto: la foto premibile è la scoperta
  per chi ci prova, il pulsante è la certezza per chi legge. Preso da
  `buttonClass("secondary")` (`components/button.tsx`), non scritto a mano.

### 2. Lo stato "sto caricando" si vede sulla foto

Oggi è una riga di testo sotto alla sezione, lontana dall'elemento che
cambia. Al posto (in aggiunta al `aria-live` per i lettori di schermo, che
resta):

- alla scelta del file si crea un `URL.createObjectURL(file)` e **si mostra
  subito l'anteprima al posto dell'avatar** — il ritaglio quadrato lo fa
  `object-cover`, lo stesso di `<Avatar>`;
- durante l'invio il cerchio va in `animate-pulse` con velo scuro e la
  scritta `account.uploading` sopra (velo `bg-black/70` fisso, non `bg-ink`,
  per la ragione già scritta in `TileButton` di `photo-picker.tsx`: nel tema
  scuro `--ink` è chiaro);
- quando `photoFetcher.state` torna `idle` si revoca l'indirizzo temporaneo e
  si azzera l'anteprima: se è andata bene la nuova immagine arriva dal
  loader rivalidato, se è andata male si torna alla vecchia e sotto compare
  l'errore. Stesso schema di rilascio di `photo-picker.tsx` (`useEffect` di
  pulizia + revoca).

### 3. Il controllo di misura e formato si fa prima di spedire

Oggi un JPEG da 12 MB parte dal telefono, sale tutto, e solo allora il server
risponde `account.errorPhotoTooBig`. Le chiavi di errore esistono già: basta
usarle anche in locale, con uno stato `localError` che si combina con quello
del fetcher (`const photoError = localError ?? fetcherError`).

I due limiti (5 MB, `image/jpeg|png|webp`) oggi sono scritti **due volte**:
`lib/uploads.server.ts:22` e `components/photo-picker.tsx:37-38`, con un
commento che ammette la copia. Con un terzo punto d'uso è il momento di
raccoglierli in **`app/lib/uploads.shared.ts`** — stessa convenzione già
usata da `availability.shared.ts` per i tetti delle date:

```ts
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
```

importato da `uploads.server.ts`, `photo-picker.tsx` e `account.tsx`.

### 4. «Togli la foto» resta un modulo suo

Rimane un `<photoFetcher.Form>` separato nella colonna di destra, sotto al
suggerimento (moduli annidati non sono HTML valido). Invariato a parte la
posizione: `Button variant="danger" size="sm"`.

## Chiavi di traduzione nuove

Da aggiungere con la skill **`add-i18n-key`** (inglese, italiano e tedesco
insieme, poi `pnpm typecheck` — regola 5):

| chiave | en | it | de |
| --- | --- | --- | --- |
| `account.photoChange` | Change photo | Cambia foto | Foto ändern |
| `account.photoAdd` | Add a photo | Aggiungi una foto | Foto hinzufügen |

Restano com'erano: `account.photo`, `account.photoAlt`, `account.photoHint`,
`account.removePhoto`, `account.uploading`, i tre `account.errorPhoto*`.

## File toccati

- `app/routes/account.tsx` — la sezione foto e il nuovo `AvatarPicker` in
  fondo al file; aggiornare il commento in cima (spiega già perché i moduli
  sono due: aggiungere perché la foto è premibile).
- `app/lib/uploads.shared.ts` — nuovo, i due limiti.
- `app/lib/uploads.server.ts`, `app/components/photo-picker.tsx` — importano
  i limiti invece di ridichiararli.
- `app/i18n/dictionaries.ts` — due chiavi per tre lingue.

Non si tocca `components/person.tsx`: `<Avatar>` resta l'immagine e basta, il
comportamento premibile sta nel guscio attorno (regola 6 — un posto solo per
come si disegna una persona).

## Verifica

```bash
pnpm typecheck
```

Poi, con `pnpm dev` e la sessione aperta su `/account`, dal vivo:

1. **Col mouse**: passare sulla foto → velo e scritta «Cambia foto»; premere
   la foto → si apre il selettore; scegliere un JPEG → anteprima immediata,
   pulsazione, poi la foto nuova. Premere il pulsante «Cambia foto» → stesso
   selettore.
2. **Da tastiera**: `Tab` fino al campo → l'anello di fuoco si vede sul
   cerchio; `Invio`/`Spazio` apre il selettore.
3. **Senza foto** (prima togliere quella che c'è): il cerchio ha il bordo
   tratteggiato, il badge fotocamera si vede, il pulsante dice «Aggiungi una
   foto».
4. **Errori locali**: scegliere un PDF rinominato `.jpg` → messaggio subito,
   nessuna richiesta in rete (si controlla nel pannello di rete); scegliere
   un file sopra i 5 MB → `account.errorPhotoTooBig` senza attesa.
5. **Telefono**: viewport a 375px → l'invito (badge + pulsante) si vede senza
   passaggio del mouse, la colonna va a capo sotto alla foto senza far
   scorrere la pagina in orizzontale.
6. **Tre lingue**: cambiare lingua e ricontrollare che i due testi nuovi ci
   siano e non escano dal pulsante.
7. **Togli la foto** → torna alle iniziali, e la stessa sezione continua a
   funzionare per un nuovo caricamento.
