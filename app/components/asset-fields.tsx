/**
 * I campi di testo di un oggetto, condivisi fra «nuovo» e «modifica» — le
 * uniche differenze fra le due pagine sono la galleria delle foto esistenti
 * (solo in modifica) e cosa succede al salvataggio.
 */

import { useT } from "~/i18n/use-t";

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
          className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
      </Field>

      <Field label={t("assets.description")} name="description">
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ""}
          className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
      </Field>

      <Field label={t("assets.location")} name="location">
        <input
          id="location"
          name="location"
          defaultValue={defaults?.location ?? ""}
          className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
      </Field>

      <Field label={t("assets.category")} name="categoryId">
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={defaults?.categoryId ?? ""}
          className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        >
          <option value="">{t("assets.noCategory")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("assets.adminNotes")} name="adminNotes">
        <textarea
          id="adminNotes"
          name="adminNotes"
          rows={2}
          defaultValue={defaults?.adminNotes ?? ""}
          className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="unavailable"
          defaultChecked={defaults?.isBookable === false}
          className="h-4 w-4"
        />
        {t("assets.markUnavailable")}
      </label>
    </>
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
        className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
