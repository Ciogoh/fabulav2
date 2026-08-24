/**
 * Come si disegna una persona: il suo nome e la sua foto.
 *
 * Due componenti soli, usati ovunque compaia qualcuno — intestazione, chat,
 * elenco dei soci, coda delle richieste, calendario. Il punto è che la regola
 * «si vede l'alias, il nome vero al passaggio del mouse» sia scritta **una
 * volta**: sparsa per sei rotte, la prossima schermata la dimenticherebbe.
 */

import { displayNameOf, fullNameOf, hasSeparateFullName, type Person } from "~/lib/person";
import { initialsOf } from "~/lib/initials";

/**
 * Il nome di una persona.
 *
 * `title` porta il nome per esteso, ma il passaggio del mouse non esiste su un
 * telefono e non esiste per chi naviga da tastiera: la stessa informazione va
 * quindi anche in un pezzo di testo per soli lettori di schermo. Quando alias
 * e nome coincidono non si aggiunge niente, o si finirebbe per annunciare
 * «Mario Rossi Mario Rossi».
 */
export function PersonName({
  person,
  className,
}: {
  person: Person;
  className?: string;
}) {
  const display = displayNameOf(person);

  if (!hasSeparateFullName(person)) {
    return <span className={className}>{display}</span>;
  }

  const full = fullNameOf(person);
  return (
    <span className={className} title={full}>
      {display}
      <span className="sr-only"> ({full})</span>
    </span>
  );
}

/**
 * Avatar e nome insieme, dentro a una frase.
 *
 * Esiste per uno sfasamento tornato tre volte, sempre scritto allo stesso
 * modo: `<span className="flex items-center gap-2">` intorno ad avatar e
 * nome. Un contenitore flex prende come propria linea di base quella del suo
 * primo elemento — l'immagine — e la linea di base di un'immagine è il suo
 * bordo inferiore. Dentro a una riga allineata con `items-baseline` il nome
 * finiva così sette pixel più in alto di tutto il resto: si vedeva nel
 * registro e nella chat di una richiesta.
 *
 * Qui non c'è nessun flex. L'avatar è un elemento in linea allineato a metà
 * del testo, quindi la linea di base della riga resta quella del nome, come
 * per qualunque altra parola — e la riga si comporta bene sia dentro a un
 * `flex items-baseline` sia dentro a un paragrafo. Fra avatar e nome non c'è
 * spazio scritto (il margine lo mette `ml-2`): senza uno spazio non c'è punto
 * dove andare a capo, e i due non si separano mai a fine riga.
 *
 * L'altra metà della regola sta in chi chiama: **la misura del testo si
 * dichiara sulla riga, non sui pezzi**. Qui dentro non c'è nessun `text-sm`
 * apposta — se lo dichiarasse, un contenitore a `text-base` si ritroverebbe
 * il nome più piccolo del resto della frase. Il difetto opposto è quello che
 * si vedeva nel registro: la riga non dichiarava niente, il nome ereditava i
 * 16px del documento e i fratelli stavano a 14.
 */
export function PersonInline({
  person,
  className,
}: {
  person: Person;
  className?: string;
}) {
  return (
    <span className={className}>
      <Avatar person={person} size="sm" />
      <PersonName person={person} className="ml-2 font-medium" />
    </span>
  );
}

const SIZES = {
  sm: "h-7 w-7 text-[0.6rem]",
  md: "h-9 w-9 text-[0.7rem]",
  lg: "h-24 w-24 text-xl",
} as const;

/**
 * La foto del profilo, o le iniziali quando non c'è.
 *
 * `aria-hidden`: accanto c'è sempre il nome scritto, quindi per un lettore di
 * schermo l'avatar è decorazione e annunciarla due volte è solo rumore.
 * L'unica eccezione è la pagina del profilo, dove la foto è il contenuto: lì
 * si passa `alt`.
 */
export function Avatar({
  person,
  size = "sm",
  alt,
}: {
  person: Person;
  size?: keyof typeof SIZES;
  alt?: string;
}) {
  // `align-middle`: quando l'avatar sta dentro a una frase (vedi
  // `PersonInline`) senza questo appoggerebbe il bordo inferiore sulla linea
  // di base del testo, spingendo in giù tutta la riga. Dentro a un flex non
  // cambia niente.
  const shape = `${SIZES[size]} shrink-0 rounded-full object-cover align-middle`;

  if (person.image) {
    return (
      <img
        src={person.image}
        alt={alt ?? ""}
        aria-hidden={alt ? undefined : true}
        className={`${shape} border border-rule bg-sunk`}
        // Chi entra con Google si porta una foto ospitata da loro: senza
        // questa riga il browser manderebbe a Google l'indirizzo della pagina
        // di Fabula da cui l'immagine viene caricata.
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={`${shape} inline-flex items-center justify-center border border-rule bg-sunk font-mono font-medium tracking-wider text-muted`}
    >
      {initialsOf(displayNameOf(person))}
    </span>
  );
}
