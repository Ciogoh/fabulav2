# Fabula — intestazione mobile: tap target da 44px e selettore lingua compatto

## Contesto

Verifica dal vivo di `try.fabulabz.com` a 375px ha trovato un problema
concreto e misurato (non un giudizio a occhio): i controlli
dell'intestazione (`app/components/site-header.tsx`) — i link Catalogue/
Calendar, il pulsante Sign in, il selettore lingua EN/IT/DE, il trigger del
menu profilo — sono alti **36px** (`min-h-9`), sotto ai minimi di Apple
(44px) e Google (48px). Il caso peggiore è il selettore lingua: tre
pulsanti da 36×36px con **2px** di distanza, un vero rischio di toccare
"IT" invece di "EN" col pollice.

Curiosamente lo stesso file usa già correttamente **44px** (`min-h-11`) per
le voci del menu profilo, con un commento che lo spiega esplicitamente
("un elenco di righe alte venti pixel, in magazzino col pollice, si
sbaglia") — è un'incoerenza interna, non una scelta deliberata: la misura
giusta è già nel file, solo non applicata dappertutto.

Discusso un hamburger menu per tutta la navigazione: scartato. Il `<nav>`
va già a capo in modo pulito (gestisce bene anche i 6 link dell'admin,
comportamento già rifinito con tanto di commento in-file), e nasconderlo
dietro un'icona costerebbe un tocco in più a un admin che controlla la coda
approvazioni più volte al giorno — non risolve un problema reale, ne
introduce uno.

Il selettore lingua invece è un caso diverso, ed è qui che la proposta
dell'utente coglie nel segno: la scelta di lingua **si salva** (cookie +
`user.language` sul profilo per chi è loggato, confermato in
`app/routes/language.tsx`), quindi si tocca quasi solo la prima volta. Tre
pulsanti sempre in vista per un'azione così rara non serve — conviene
raccoglierli in un unico trigger compatto che apre un piccolo menu, come già
succede per il menu del profilo nello stesso file.

## Cosa cambio

Tutto dentro **`app/components/site-header.tsx`**, nessun altro file:

1. **Estraggo la logica di apertura/chiusura** (hover solo da mouse vero,
   Escape, click fuori, blur) già scritta per `ProfileMenu` in un piccolo
   hook privato `useDisclosure()`, e la riuso per il nuovo menu lingua
   invece di duplicare ~40 righe di logica sensibile all'accessibilità.
2. **Sostituisco `LanguageSwitch`** (tre `<button>` da 36×36 sempre visibili)
   con **`LanguageMenu`**: un trigger da 44×44px che mostra la lingua
   corrente (es. "EN" + freccina, stesso stile del trigger del profilo) e
   apre un pannello con le tre lingue per esteso ("English", "Italiano",
   "Deutsch"), righe da 44px riusando la costante `ITEM` già presente per il
   menu profilo. Il submit resta un `fetcher.Form` verso `/language` come
   oggi — stesso aggiornamento immediato senza attesa server, stessa
   `redirectTo` nascosta.
3. **Alzo `LINK`** (Catalogue, Calendar, voci admin) da `min-h-9` a
   `min-h-11`.
4. **Alzo il trigger del `ProfileMenu`** da `min-h-9` a `min-h-11`.
5. **Il pulsante "Sign in"** passa da `size="sm"` a `size="md"` su
   `ButtonLink` — è l'unica istanza da cambiare, non tocco la costante
   `SIZES` condivisa in `button.tsx`: "sm" resta 36px per gli altri usi
   nell'app, dove può avere senso restare compatto.

Non tocco `i18n/dictionaries.ts` (le stringhe per esteso delle lingue,
`LANGUAGE_NAMES`, esistono già), né altri componenti.

## Verifica

1. `pnpm typecheck`
2. Nel browser a 375px: nuova misura dei bounding rect via JS (come fatto in
   fase di analisi) per confermare che nav, trigger lingua, trigger profilo
   e Sign in siano tutti ≥44px, e che il pannello lingua abbia righe ≥44px.
3. Provare dal vivo: aprire il menu lingua, cambiare lingua, controllare che
   il testo della pagina cambi subito e il redirect torni dove si era;
   Escape e click fuori chiudono entrambi i menu (lingua e profilo); il
   passaggio del mouse apre solo da mouse vero, non da tocco.
4. Controllare che la vista admin (6 link nel `<nav>`) vada ancora a capo
   in modo pulito a 375px, senza scroll orizzontale.
5. Controllo veloce a larghezza desktop che nulla sia regredito visivamente.

---

Nota: il backup automatico su OneDrive (`scripts/backup.sh` +
documentazione in `CLAUDE.md`) è già stato scritto in una sessione
precedente ed è fuori dallo scope di questo piano — l'attivazione (rclone
config + crontab) resta rimandata a quando l'utente deciderà di occuparsene.
