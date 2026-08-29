# Rifinitura d'insieme — quello che resta

Scritto **dopo** il primo giro, e per una volta va bene così: questo non era
un piano da fare, era un giro di controllo. Fabula è stata guardata schermata
per schermata a 375px e a 1440px, nei due temi, col Tab e con lo zoom del
testo. Quello che è stato corretto sta nella voce 0.9.0 del
[CHANGELOG](../../CHANGELOG.md); qui c'è il resto, in ordine di quanto si
sente usando.

La misura di questo elenco è sempre la stessa: **un socio col telefono in
mano in magazzino**, non una schermata guardata da vicino su un monitor.

---

## A. Le tre primitive che ancora non ci sono

I pulsanti, il guscio di pagina, il menu a tendina, il badge di stato, il
dialogo e adesso l'etichetta e il campo hanno un posto solo. Tre segni no, e
sono gli stessi tre che prima o poi divergeranno:

1. **La scheda** — `rounded border border-rule bg-card`, scritta a mano
   **39 volte**. Alcune hanno `p-4`, altre `p-3`, altre `p-5`; alcune
   `hover:border-accent`, altre no. Serve `Card`, o un `@utility card` come
   per `field`.
2. **La pastiglia** che non è uno stato di prestito — il conteggio del
   Centro, il marchio «KIT», lo stato di una richiesta, «non letto», «già
   preso», «in attesa da N giorni». Sei fatture leggermente diverse. `Pill`
   esiste già ma vive dentro a `admin.tsx` e non lo vede nessun altro: va
   tirato fuori.
3. **`buttonClass()` su un `<button>` nudo** — resta in una decina di punti.
   Funziona, ma nessuno di quei pulsanti può avere `busy`, e sono proprio
   quelli che mandano qualcosa: salva oggetto, salva kit, aggiungi categoria,
   segna ritiro, segna riconsegna, nota interna, manda promemoria. Vanno
   convertiti a `<Button busy={fetcher.state !== "idle"}>`.

## B. La password non si vede mai

Cinque campi password (accesso, benvenuto ×2, reimposta ×2) e **nessuno ha il
bottone occhio**. Su un telefono, dieci caratteri obbligatori scritti alla
cieca sono la ragione numero uno per cui si abbandona una registrazione. Il
gestore di password non è un'alternativa: chi ne ha uno non arriva a quel
campo, chi non ce l'ha è esattamente la persona che sta sbagliando a digitare.

## C. Il successo non si vede quasi mai

Il promemoria a mano dice «mandato», il profilo dice «salvato». Tutto il resto
— approva, rifiuta, segna ritiro, segna riconsegna, salva oggetto, crea kit,
sposta una categoria — cambia la pagina e basta. Quando il cambiamento si vede
(lo stato che passa a «approvata») va bene; quando non si vede (la nota
interna salvata, una categoria spostata di un posto) chi ha premuto non sa se
è successo, e preme di nuovo. **Non serve un sistema di notifiche**: serve la
stessa riga in `aria-live` che c'è già nel profilo, messa dove manca.

## D. Il catalogo, due domande aperte

Nessuna delle due è un difetto: sono due scelte da riprendere in mano.

- **Venti pulsanti «Aggiungi» con la cornice d'accento** sono il segno più
  forte della griglia, e la griglia parla di oggetti. Passarli a `quiet` fa
  emergere le fasce di stato e le foto; il rischio è che chi arriva la prima
  volta non veda più com'è che si prende una cosa. Da provare su qualcuno,
  non da decidere a tavolino.
- **`items-start` lascia la griglia frastagliata** su schermo largo — voluto,
  perché senza, una scheda con foto stira le vicine. Una via di mezzo esiste
  (un'altezza minima di scheda), ma prima vale la pena aspettare che le foto
  ci siano su tutti gli oggetti: se il problema sparisce da solo, non è un
  problema di layout.

## E. Il telefono, tre cose ancora larghe

- L'elenco oggetti dell'admin mette nome e azione su due righe, e una riga di
  oggetto è alta 120px: venti oggetti sono otto schermate.
- ~~Il Centro con due sezioni vuote su quattro spende metà schermo per dire
  che non c'è niente da fare.~~ **Fatto nella 0.9.1**, e più a fondo di così:
  le sezioni sono sparite del tutto, sostituite da una coda con i motivi come
  marcatori sulla riga e da un'agenda che compare solo se ha qualcosa.
- Il nome dell'oggetto sul calendario si tronca con `title=`, che col dito non
  esiste. Stesso difetto già corretto sulle barre, non ancora sulla colonna
  dei nomi.

## F. Il carrello non si annulla

«Svuota» svuota, e basta. Su dieci oggetti scelti uno a uno è un gesto che si
rimpiange. Un «annulla» per qualche secondo costa poco: la lista è già in
memoria.

## G. Quello che sta altrove

Il rebrand su Material Matters (il logo oggi è magenta, la direzione dice
rosso) e la prova su iPhone e Android veri restano dove sono, in cima a
*A che punto siamo* di [`CLAUDE.md`](../../CLAUDE.md). Questo giro non li
tocca, e nessuna delle voci qui sopra li presuppone: la scala dei corpi e le
utility nuove sono proprio ciò che rende il cambio di carattere una
sostituzione di valori invece di un giro per venti file.
