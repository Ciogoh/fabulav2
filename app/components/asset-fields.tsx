/**
 * I campi di testo di un oggetto, condivisi fra «nuovo» e «modifica» — le
 * uniche differenze fra le due pagine sono la galleria delle foto esistenti
 * (solo in modifica) e cosa succede al salvataggio.
 */

import { useState } from "react";
import { useT } from "~/i18n/use-t";
import { Select } from "~/components/select";
import { MAX_CATEGORY_NAME, NEW_CATEGORY } from "~/lib/categories";

/** Scritta a mano in otto punti: vedi la nota in CLAUDE.md sulle convenzioni. */
const FIELD = "min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm";

export type AssetDefaults = {
  name?: string;
  description?: string | null;
  location?: string | null;
  categoryId?: string | null;
  adminNotes?: string | null;
  isBookable?: boolean;
};

export function AssetFields({
  categories,
  defaults,
}: {
  categories: Array<{ id: string; name: string }>;
  defaults?: AssetDefaults;
}) {
  const t = useT();

  return (
    <>
      <Field label={t("assets.name")} name="name">
        <input
          id="name"
          name="name"
          defaultValue={defaults?.name}
          required
          minLength={2}
          maxLength={120}
          className={FIELD}
        />
      </Field>

      <Field label={t("assets.description")} name="description">
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ""}
          className={FIELD}
        />
      </Field>

      <Field label={t("assets.location")} name="location">
        <input
          id="location"
          name="location"
          defaultValue={defaults?.location ?? ""}
          className={FIELD}
        />
      </Field>

      <CategoryField
        categories={categories}
        defaultValue={defaults?.categoryId ?? ""}
      />

      <Field label={t("assets.adminNotes")} name="adminNotes">
        <textarea
          id="adminNotes"
          name="adminNotes"
          rows={2}
          defaultValue={defaults?.adminNotes ?? ""}
          className={FIELD}
        />
      </Field>

      {/* Stessa misura della spunta nel foglio della richiesta: 20px in una
          riga alta 44, e tutta la riga è cliccabile. */}
      <label className="-my-1 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="unavailable"
          defaultChecked={defaults?.isBookable === false}
          className="h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        {t("assets.markUnavailable")}
      </label>
    </>
  );
}

/**
 * La categoria: sceglierne una, o inventarne una qui.
 *
 * L'ultima voce del menu è «+ Nuova categoria…», e sceglierla apre un campo
 * di testo sotto. Nessun'altra pagina da visitare, nessun oggetto da salvare
 * a metà: la categoria nasce nello stesso invio dell'oggetto (vedi
 * `categories.server.ts`).
 *
 * Il campo che compare prende il fuoco da solo — chi ha appena scelto quella
 * voce sta già scrivendo il nome, e senza `autoFocus` le prime lettere
 * finiscono nel vuoto.
 */
function CategoryField({
  categories,
  defaultValue,
}: {
  categories: Array<{ id: string; name: string }>;
  defaultValue: string;
}) {
  const t = useT();
  const [choice, setChoice] = useState(defaultValue);
  const creating = choice === NEW_CATEGORY;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="categoryId"
        className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
      >
        {t("assets.category")}
      </label>

      <Select
        id="categoryId"
        name="categoryId"
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
      >
        <option value="">{t("assets.noCategory")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        <option value={NEW_CATEGORY}>{t("assets.categoryNew")}</option>
      </Select>

      {creating && (
        <input
          name="newCategory"
          autoFocus
          required
          minLength={2}
          maxLength={MAX_CATEGORY_NAME}
          placeholder={t("assets.categoryNewPlaceholder")}
          aria-label={t("assets.categoryNewPlaceholder")}
          className={`mt-1 ${FIELD}`}
        />
      )}
    </div>
  );
}

function Field({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
