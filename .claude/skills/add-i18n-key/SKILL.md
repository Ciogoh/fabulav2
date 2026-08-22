---
name: add-i18n-key
description: Aggiunge nuove chiavi di traduzione a app/i18n/dictionaries.ts nel progetto Fabula — inglese, italiano e tedesco insieme, nello stile già presente — e verifica con pnpm typecheck che nessuna lingua sia rimasta indietro. Consulta questa skill ogni volta che stai costruendo o modificando una pagina o un componente di Fabula che ha bisogno di nuovo testo per l'interfaccia, prima di scrivere `t("qualcosa")` con una chiave che non esiste ancora.
user-invocable: false
---

# Aggiungere chiavi di traduzione a Fabula

`app/i18n/dictionaries.ts` ha tre dizionari — `en`, `it`, `de` — oggetti
piatti con le stesse chiavi stringa. `en` è di riferimento: definisce
`TranslationKey` con `keyof typeof en`, quindi se `it` o `de` non hanno una
chiave che `en` ha, `pnpm typecheck` fallisce con un errore di tipo netto
("Property 'x' is missing in type..."). Questo è il meccanismo — non serve
altro per sapere se una chiave manca da qualche parte.

## Come sono organizzate le chiavi

Convenzione `namespace.nomeChiave` (`assets.errorPhotoTooBig`,
`welcome.passwordMismatch`, `requests.admin.approve`) — il namespace di
solito coincide con la pagina o la funzionalità. Le chiavi nuove vanno
**vicino alle altre chiavi dello stesso namespace**, non aggiunte in fondo
al file: chi legge il file dopo deve trovarle raggruppate, non sparse in
ordine cronologico di quando sono state scritte.

I tre blocchi (`en`, `it`, `de`) mantengono lo stesso ordine di chiavi fra
loro — quando aggiungi una chiave, tienila nella stessa posizione relativa
in tutti e tre, così un confronto riga per riga resta possibile.

Placeholder tipo `{count}` o `{email}` dentro una stringa vengono sostituiti
da `translate()` (nello stesso file) con i parametri passati a `t()` —
usali quando il testo ha bisogno di un valore dinamico, mai concatenando
stringhe a mano nel componente.

## Procedura

1. **Guarda le chiavi già vicine nello stesso namespace** per il tono: le
   frasi di Fabula sono dirette, informali, mai gergali — spiegano la
   conseguenza di un'azione più che descriverla ("Il nome è salvato, ma...”
   non "Operazione parzialmente riuscita"). Il tedesco usa il "du"
   informale, non il "Sie".
2. **Scrivi la stessa chiave nei tre blocchi**, con traduzioni coerenti fra
   loro (stesso significato, non necessariamente la stessa lunghezza — ogni
   lingua ha il suo modo naturale di dirlo).
3. **Usa la chiave nel componente/azione** con `t("namespace.chiave")`.
4. **Verifica**, da dentro `fabula/`:

   ```bash
   pnpm typecheck
   ```

   Se manca una chiave in una lingua, l'errore indica esattamente quale.
   Non considerare finito il lavoro finché questo comando non è pulito.

## Chiavi di errore

Quando la chiave è un messaggio d'errore restituito da una action
(`{ error: "namespace.errorQualcosa" as TranslationKey }`), assicurati che
il tipo dell'espressione combaci con `TranslationKey` — è il pattern già
usato in tutte le action di Fabula (`app/routes/*.tsx`) per farsi segnalare
da `tsc`, non solo da `pnpm typecheck`, se la chiave scritta lì non esiste
in `en`.
