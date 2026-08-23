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
  const shape = `${SIZES[size]} shrink-0 rounded-full object-cover`;

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
      className={`${shape} flex items-center justify-center border border-rule bg-sunk font-mono font-medium tracking-wider text-muted`}
    >
      {initialsOf(displayNameOf(person))}
    </span>
  );
}
