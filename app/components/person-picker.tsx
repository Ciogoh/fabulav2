/**
 * Scegliere una persona da un elenco che può essere lungo.
 *
 * È il fratello a scelta singola di `AssetPicker` in `kit-fields.tsx`: stessa
 * forma — un campo di ricerca sopra, un elenco scorrevole sotto — perché
 * risolve lo stesso problema, trovare una riga fra tante col dito su un
 * telefono. Un `<select>` non andava bene: con duecento soci diventa una
 * colonna infinita che non si può filtrare.
 *
 * **La ricerca nasconde le righe, non le smonta**, esattamente come nel
 * selettore dei pezzi. Qui la conseguenza è ancora più diretta: la scelta è un
 * gruppo di radio, e una radio spuntata che sparisce dal documento sparisce
 * anche dall'invio — si sarebbe scelto «Marco», poi cercato «Anna» per
 * ripensarci, e il modulo sarebbe partito senza nessuno selezionato.
 *
 * La ricerca guarda anche l'indirizzo email e non solo il nome: in
 * un'associazione dentro a un'università i nomi si somigliano, e chi consegna
 * ha spesso davanti l'indirizzo istituzionale di chi ritira.
 */

import { useState } from "react";
import { Avatar, PersonName } from "~/components/person";
import { displayNameOf, fullNameOf, type Person } from "~/lib/person";
import { useT } from "~/i18n/use-t";

const FIELD = "min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm";

export type PickablePerson = Person & { id: string; email: string };

export function PersonPicker({
  people,
  name,
  label,
}: {
  people: PickablePerson[];
  /** Il nome del campo che arriverà nella `action`. */
  name: string;
  label: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();

  const matches = (person: PickablePerson) =>
    !needle ||
    displayNameOf(person).toLowerCase().includes(needle) ||
    fullNameOf(person).toLowerCase().includes(needle) ||
    person.email.toLowerCase().includes(needle);

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
        {label}
      </legend>

      {people.length === 0 ? (
        <p className="text-sm text-muted">{t("handover.noPeople")}</p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("handover.searchPlaceholder")}
            aria-label={t("handover.searchPlaceholder")}
            className={FIELD}
          />

          <div className="max-h-72 overflow-y-auto rounded border border-rule bg-card">
            <ul>
              {people.map((person) => (
                <li key={person.id} className={matches(person) ? undefined : "hidden"}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-sunk">
                    <input
                      type="radio"
                      name={name}
                      value={person.id}
                      checked={chosen === person.id}
                      onChange={() => setChosen(person.id)}
                      required
                      className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                    />
                    <Avatar person={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <PersonName person={person} className="font-medium" />
                      {/* L'indirizzo sotto al nome e non accanto: su un
                          telefono, accanto, spingerebbe il nome fuori. */}
                      <span className="block truncate text-[0.8rem] text-muted">
                        {person.email}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Chi è stato scelto resta scritto anche dopo aver cercato
              qualcos'altro, altrimenti l'unica conferma della scelta è un
              pallino nascosto da un filtro. */}
          <p aria-live="polite" className="text-sm text-muted">
            {chosen
              ? t("handover.chosen", {
                  name: displayNameOf(people.find((p) => p.id === chosen)!),
                })
              : t("handover.chooseHint")}
          </p>
        </>
      )}
    </fieldset>
  );
}
