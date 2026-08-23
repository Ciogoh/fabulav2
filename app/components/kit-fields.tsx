/**
 * I campi di un kit, condivisi fra «nuovo» e «modifica»: nome, descrizione e
 * i pezzi che lo compongono.
 *
 * Il selettore dei pezzi è un elenco di caselle da spuntare e non un menu a
 * scelta multipla: la domanda a cui deve rispondere è «cosa c'è dentro a
 * questo kit», e la risposta si legge tutta insieme, col segno di spunta
 * accanto ai pezzi che ci sono. Sono raggruppati per categoria e nell'ordine
 * del catalogo, che è anche l'ordine in cui il kit li mostrerà.
 *
 * **La ricerca nasconde le righe, non le smonta.** Una casella spuntata che
 * sparisce dal documento sparisce anche dall'invio: si sarebbe cercato
 * «cavo», aggiunto un cavo, e al salvataggio il mixer spuntato prima non
 * sarebbe più stato nel kit. `hidden` la toglie dagli occhi lasciandola nel
 * modulo, perché un controllo nascosto viene spedito lo stesso.
 */

import { useMemo, useState } from "react";
import { useT } from "~/i18n/use-t";

const FIELD = "min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm";

export type KitAssetOption = {
  id: string;
  name: string;
  categoryName: string | null;
  thumbUrl: string | null;
};

export type KitDefaults = {
  name?: string;
  description?: string | null;
  assetIds?: string[];
};

export function KitFields({
  assets,
  defaults,
}: {
  assets: KitAssetOption[];
  defaults?: KitDefaults;
}) {
  const t = useT();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
          {t("kits.name")}
        </label>
        <input
          id="name"
          name="name"
          defaultValue={defaults?.name}
          required
          minLength={2}
          maxLength={120}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
        >
          {t("kits.description")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaults?.description ?? ""}
          className={FIELD}
        />
      </div>

      <AssetPicker assets={assets} selected={defaults?.assetIds ?? []} />
    </>
  );
}

function AssetPicker({
  assets,
  selected,
}: {
  assets: KitAssetOption[];
  selected: string[];
}) {
  const t = useT();
  const [chosen, setChosen] = useState(() => new Set(selected));
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();

  const groups = useMemo(() => groupsOf(assets), [assets]);

  const matches = (asset: KitAssetOption) =>
    !needle ||
    asset.name.toLowerCase().includes(needle) ||
    (asset.categoryName?.toLowerCase().includes(needle) ?? false);

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
        {t("kits.pieces")}
      </legend>

      {assets.length === 0 ? (
        <p className="text-sm text-muted">{t("kits.noAssets")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("assets.searchPlaceholder")}
              aria-label={t("catalogue.search")}
              className={`${FIELD} min-w-48 flex-1`}
            />
            {/* Il conto sta accanto alla ricerca e non in fondo all'elenco:
                filtrando si vedono tre righe su duecento, e senza questo non
                si saprebbe più quanti pezzi ha il kit che si sta montando. */}
            <span
              aria-live="polite"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
            >
              {t("kits.chosenCount", { count: chosen.size })}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto rounded border border-rule bg-card">
            {groups.map((group) => {
              const visible = group.assets.some(matches);

              return (
                <div key={group.key} className={visible ? undefined : "hidden"}>
                  <p className="sticky top-0 border-b border-rule bg-sunk px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
                    {group.name ?? t("assets.noCategory")}
                  </p>

                  <ul>
                    {group.assets.map((asset) => (
                      <li key={asset.id} className={matches(asset) ? undefined : "hidden"}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-sunk">
                          <input
                            type="checkbox"
                            name="assetIds"
                            value={asset.id}
                            checked={chosen.has(asset.id)}
                            onChange={() => toggle(asset.id)}
                            className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                          />
                          <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-sunk">
                            {asset.thumbUrl && (
                              <img src={asset.thumbUrl} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-muted">{t("kits.piecesHint")}</p>
        </>
      )}
    </fieldset>
  );
}

/** Gli oggetti già ordinati, spezzati in gruppi consecutivi per categoria. */
function groupsOf(assets: KitAssetOption[]) {
  const groups: Array<{ key: string; name: string | null; assets: KitAssetOption[] }> = [];

  for (const asset of assets) {
    const key = asset.categoryName ?? "-";
    const last = groups.at(-1);
    if (last?.key === key) last.assets.push(asset);
    else groups.push({ key, name: asset.categoryName, assets: [asset] });
  }

  return groups;
}
