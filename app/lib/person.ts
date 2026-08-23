/**
 * Come si chiama una persona, e quale dei suoi nomi si mostra.
 *
 * La regola, decisa dall'utente: **si vede sempre l'alias**; nome e cognome
 * stanno sotto, nel suggerimento del passaggio del mouse. Chi l'alias non ce
 * l'ha si vede col nome e cognome, e allora il suggerimento non serve —
 * ripetere la stessa stringa in un `title` è solo rumore.
 *
 * Modulo condiviso, senza importazioni dal server: le stesse funzioni servono
 * ai componenti nel browser e alle email dal server, e due copie che si
 * separano vorrebbero dire una persona chiamata in due modi diversi nella
 * stessa applicazione.
 */

/** Quel tanto che basta per decidere come chiamare qualcuno. */
export type Person = {
  /** Il nome in una stringa sola di Better Auth: ripiego per gli account
   * creati prima che nome e cognome esistessero. */
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  alias?: string | null;
  image?: string | null;
};

/** Nome e cognome: «Mario Rossi». */
export function fullNameOf(person: Person): string {
  const parts = [person.firstName, person.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : person.name.trim();
}

/** Quello che si legge a schermo: l'alias se c'è, altrimenti nome e cognome. */
export function displayNameOf(person: Person): string {
  return person.alias?.trim() || fullNameOf(person);
}

/** Vero quando alias e nome per esteso dicono cose diverse, cioè quando il
 * suggerimento del passaggio del mouse ha qualcosa da aggiungere. */
export function hasSeparateFullName(person: Person): boolean {
  const full = fullNameOf(person);
  return full.length > 0 && full !== displayNameOf(person);
}

/**
 * Per gli admin e per le email: «Vale (Mario Rossi)».
 *
 * Chi deve decidere su una richiesta o consegnare un oggetto di persona ha
 * bisogno del nome vero, non solo di come uno si fa chiamare — ma l'alias
 * resta davanti, perché è con quello che la persona si presenta in chat.
 */
export function fullLabelOf(person: Person): string {
  return hasSeparateFullName(person)
    ? `${displayNameOf(person)} (${fullNameOf(person)})`
    : displayNameOf(person);
}

/**
 * La foto viene da noi o da fuori?
 *
 * Chi entra con Google si porta dietro un indirizzo `lh3.googleusercontent.com`
 * scritto da Better Auth. Va mostrato — è comunque la sua foto — ma non va mai
 * passato a `unlink`: quel percorso non esiste sul disco.
 */
export function isUploadedAvatar(image: string | null | undefined): boolean {
  return Boolean(image?.startsWith("/uploads/"));
}

/* ------------------------------------------------ nomi che arrivano da fuori */

/**
 * Ripulisce un nome scritto da qualcun altro.
 *
 * L'università scrive i nomi come **«Mogno Samuele (Student DES 25)»**: il
 * cognome davanti e, in coda, facoltà e anno di corso fra parentesi. Quel
 * pezzo fra parentesi non è parte del nome di nessuno, e in un campo «cognome»
 * è solo sporcizia che poi si trascina in ogni email e in ogni schermata.
 *
 * Toglie **una sola** parentesi finale, non tutte quelle che trova: chi si
 * chiama davvero «Anna (Nina) Rossi» tiene il suo soprannome dov'è.
 */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s*\([^()]*\)\s*$/, "").trim();
}

/**
 * «Mario Rossi» → «Mario» + «Rossi», per riempire i due campi in anticipo.
 *
 * È l'ultima spiaggia, non la strada principale: da Microsoft nome e cognome
 * arrivano separati nel token e li scriviamo da lì, perché **da una stringa
 * sola non si possono indovinare** — «Mogno Samuele» e «Samuele Mogno» sono
 * indistinguibili. Questo serve a chi entra col codice via email (dove `name`
 * è la parte davanti alla chiocciola) e a un provider che un giorno non
 * mandasse i due campi.
 *
 * Si taglia al **primo** spazio e non all'ultimo perché qui i cognomi composti
 * sono più comuni dei nomi composti: «Mario De Luca» resta intero, mentre
 * «Mario De» + «Luca» sarebbe sbagliato in un modo che non si nota rileggendo.
 */
export function splitName(raw: string): { firstName: string; lastName: string } {
  const name = cleanName(raw);
  const cut = name.indexOf(" ");
  if (cut === -1) return { firstName: name, lastName: "" };

  return { firstName: name.slice(0, cut), lastName: name.slice(cut + 1).trim() };
}

/**
 * «Mogno Samuele» → «Samuele» + «Mogno».
 *
 * L'ordine con cui l'università scrive i nomi: **prima il cognome, il nome per
 * ultimo**. Serve solo come ripiego per gli accessi Microsoft, dove quel
 * formato è certo perché l'applicazione è legata al tenant dell'università —
 * non è una regola generale, e infatti `splitName` continua a fare il
 * contrario per tutti gli altri.
 *
 * Prende come nome **l'ultima** parola e lascia tutto il resto al cognome, così
 * «De Luca Mario» resta «Mario» + «De Luca». Chi ha due nomi di battesimo ne
 * vedrà uno solo: da una stringa non si può sapere, ed è per questo che la
 * schermata di benvenuto li fa comunque confermare.
 */
export function givenNameLast(raw: string): { firstName: string; lastName: string } {
  const name = cleanName(raw);
  const cut = name.lastIndexOf(" ");
  if (cut === -1) return { firstName: name, lastName: "" };

  return { firstName: name.slice(cut + 1), lastName: name.slice(0, cut).trim() };
}

/* --------------------------------------------------------------- limiti */

export const MAX_NAME_PART = 40;
export const MAX_ALIAS = 40;
/** Un nome vuoto lascerebbe gli admin davanti a una richiesta senza mittente. */
export const MIN_NAME_PART = 2;
