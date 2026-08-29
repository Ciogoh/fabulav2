/**
 * L'elenco degli oggetti, per gli admin.
 *
 * Tre cose che prima non c'erano, e che sono le stesse tre che si chiedono a
 * un magazzino di duecento pezzi:
 *
 * - **Dov'è quello che cerco.** Una casella di ricerca che filtra mentre si
 *   scrive: nome o categoria, come nel catalogo pubblico.
 * - **Quanti ne ho di questo tipo.** Le pasticche in cima contano gli oggetti
 *   di ogni categoria, compresa «senza categoria» — che è l'unico modo per
 *   accorgersi che venti pezzi non ne hanno una.
 * - **Come sono messi.** Senza filtri l'elenco è raggruppato per categoria
 *   invece di essere una colonna piatta di nomi.
 *
 * Il filtro sta nell'indirizzo (`?cat=audio`) e non in uno stato del
 * componente: così la pagina delle categorie può mandare qui con la categoria
 * già scelta, e il collegamento si può tenere aperto in una scheda.
 *
 * Ricerca e raggruppamento avvengono **nel browser** sull'elenco già
 * scaricato: sono qualche centinaio di righe, e un giro col server a ogni
 * lettera darebbe un ritardo che si sente senza risparmiare niente.
 *
 * L'interruttore «non disponibile» resta a un click — non serve aprire la
 * scheda intera solo per segnare che qualcosa è in riparazione.
 *
 * Le spunte a sinistra servono a una cosa sola: **spostare più oggetti in una
 * categoria in un colpo**. La pasticca «senza categoria» dice che venti pezzi
 * non ne hanno una, e senza questo la risposta sarebbe venti moduli aperti e
 * salvati a mano. La selezione vive in React e non nelle caselle: filtrando,
 * le righe si smontano, e con loro se ne andrebbe quello che avevi già scelto.
 *
 * Gli **archiviati** non stanno in questo elenco: hanno la loro vista, dietro
 * all'ultima pasticca, perché sono roba che l'associazione non ha più.
 */

import { useMemo, useState } from "react";
import { Form, Link, useFetcher, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.assets";
import { PageShell, PageTitle } from "~/components/page";
import { buttonClass, ButtonLink } from "~/components/button";
import { AdminTabs } from "~/components/admin-tabs";
import { Select } from "~/components/select";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "assets.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const archived = new URL(request.url).searchParams.get("archived") === "1";

  const [assets, categories, archivedCount] = await Promise.all([
    db.asset.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      // Gli oggetti senza categoria finiscono in fondo: in PostgreSQL un
      // `NULL` in ordine crescente sta per ultimo, che è esattamente dove
      // serve il gruppo «senza categoria».
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isBookable: true,
        category: { select: { name: true, slug: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { thumbUrl: true } },
      },
    }),
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.asset.count({ where: { archivedAt: { not: null } } }),
  ]);

  return { assets, categories, archived, archivedCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();

  if (String(form.get("intent")) === "assignCategory") {
    const ids = [...new Set(form.getAll("ids").map(String).filter(Boolean))];
    if (ids.length === 0) return { ok: false as const };

    /* Un id inventato non passa: se la categoria non esiste, `updateMany`
       fallirebbe sulla chiave esterna con un 500 invece che con un rifiuto. */
    const raw = String(form.get("categoryId") ?? "");
    if (!raw) return { ok: false as const };

    let categoryId: string | null = null;
    if (raw !== CLEAR_CATEGORY) {
      const category = await db.category.findUnique({
        where: { id: raw },
        select: { id: true },
      });
      if (!category) return { ok: false as const };
      categoryId = category.id;
    }

    const { count } = await db.asset.updateMany({
      where: { id: { in: ids } },
      data: { categoryId },
    });
    return { ok: true as const, assigned: count };
  }

  const id = String(form.get("id") ?? "");
  const asset = await db.asset.findUnique({ where: { id }, select: { isBookable: true } });
  if (!asset) return { ok: false as const };

  await db.asset.update({ where: { id }, data: { isBookable: !asset.isBookable } });
  return { ok: true as const };
}

type AssetRow = Route.ComponentProps["loaderData"]["assets"][number];

/** Il gruppo degli oggetti senza categoria, che nell'indirizzo si scrive così. */
const NO_CATEGORY = "-";

/**
 * «Togli la categoria» nel menu dello spostamento in blocco.
 *
 * Non può essere la stringa vuota: quella è il valore del segnaposto «Sposta
 * in…», e con il segnaposto che vale «nessuna categoria» bastava premere
 * «Sposta» senza scegliere per svuotare la categoria di venti oggetti in un
 * colpo. Adesso la stringa vuota non è una scelta valida — `required` sul menu
 * la blocca — e togliere la categoria è una voce che si sceglie apposta.
 */
const CLEAR_CATEGORY = "__none__";

export default function AdminAssets({ loaderData }: Route.ComponentProps) {
  const { assets, categories, archived, archivedCount } = loaderData;
  const t = useT();

  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat") ?? "";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of assets) {
      const key = asset.category?.slug ?? NO_CATEGORY;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [assets]);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      assets.filter((asset) => {
        const slug = asset.category?.slug ?? NO_CATEGORY;
        if (activeCategory && slug !== activeCategory) return false;
        if (!needle) return true;
        // Nome o categoria: chi scrive «audio» a volte cerca l'oggetto e a
        // volte tutto il gruppo, come nel catalogo pubblico.
        return (
          asset.name.toLowerCase().includes(needle) ||
          (asset.category?.name.toLowerCase().includes(needle) ?? false)
        );
      }),
    [assets, activeCategory, needle]
  );

  /* Il raggruppamento serve a leggere l'insieme; quando si è già filtrato o
     cercato l'insieme è la risposta, e un'intestazione sopra a ogni riga
     diventa rumore. */
  const grouped = !activeCategory && !needle;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleChosen =
    visible.length > 0 && visible.every((asset) => selected.has(asset.id));

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const asset of visible) {
        if (allVisibleChosen) next.delete(asset.id);
        else next.add(asset.id);
      }
      return next;
    });
  }

  /* Spostare in blocco ha senso su ciò che è in catalogo. Sugli archiviati la
     categoria non la vede nessuno, quindi lì le spunte non compaiono. */
  const selectable = !archived;

  return (
    <main>
      {/* Con la barra aperta serve più spazio in fondo, o sul telefono copre
          le ultime due righe dell'elenco proprio mentre le si sta spuntando. */}
      <PageShell
        width="narrow"
        className={selected.size > 0 ? "pb-48 pt-8" : "pb-24 pt-8"}
      >
        <PageTitle
          title={t("assets.heading")}
          actions={
            <ButtonLink to="/admin/assets/new" variant="primary">
              {t("assets.new")}
            </ButtonLink>
          }
        />

        <div className="mt-6">
          <AdminTabs />
        </div>

        {assets.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("assets.empty")}</p>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("assets.searchPlaceholder")}
                aria-label={t("catalogue.search")}
                className="field"
              />

              <CategoryChips
                categories={categories}
                counts={counts}
                total={assets.length}
                active={activeCategory}
                archived={archived}
                archivedCount={archivedCount}
              />
            </div>

            {selectable && visible.length > 0 && (
              <label className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={allVisibleChosen}
                  onChange={toggleVisible}
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                {t("assets.selectVisible", { count: visible.length })}
              </label>
            )}

            {visible.length === 0 ? (
              <p className="mt-16 text-center text-muted">{t("assets.noneFound")}</p>
            ) : grouped ? (
              <div className="mt-6 flex flex-col gap-6">
                {groupsOf(visible).map((group) => (
                  <section key={group.slug}>
                    <h2 className="eyebrow">
                      {group.name ?? t("assets.noCategory")}
                      <span className="ml-2 tabular-nums">{group.assets.length}</span>
                    </h2>
                    <ul className="mt-2 flex flex-col gap-2">
                      {group.assets.map((asset) => (
                        /* Dentro a un gruppo la categoria è già scritta
                           sopra: ripeterla sotto ogni nome è la stessa
                           parola otto volte di fila. */
                        <AssetItem
                          key={asset.id}
                          asset={asset}
                          showCategory={false}
                          archived={archived}
                          chosen={selectable ? selected.has(asset.id) : undefined}
                          onChoose={toggle}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="mt-6 flex flex-col gap-2">
                {visible.map((asset) => (
                  <AssetItem
                    key={asset.id}
                    asset={asset}
                    archived={archived}
                    chosen={selectable ? selected.has(asset.id) : undefined}
                    onChoose={toggle}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </PageShell>

      {selectable && selected.size > 0 && (
        <AssignBar
          categories={categories}
          ids={[...selected]}
          onDone={() => setSelected(new Set())}
        />
      )}
    </main>
  );
}

/**
 * La barra che compare quando qualcosa è selezionato.
 *
 * Appoggiata in fondo allo schermo come il carrello del catalogo pubblico: è
 * lo stesso gesto — scegli delle cose in un elenco lungo, e l'azione ti
 * raggiunge invece di farti risalire in cima. Il `pb-24` del guscio della
 * pagina esiste già per questo, quindi non copre l'ultima riga.
 *
 * Gli id viaggiano come campi nascosti e non come caselle spuntate: le righe
 * si smontano quando si filtra, e con loro sparirebbe metà della selezione
 * dall'invio.
 */
function AssignBar({
  categories,
  ids,
  onDone,
}: {
  categories: Array<{ id: string; name: string }>;
  ids: string[];
  onDone: () => void;
}) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";

  // Svuota la selezione quando la risposta arriva, una volta sola: guardare
  // solo `data.ok` la ripulirebbe anche al giro dopo. Stesso motivo del campo
  // «nuova categoria» in admin.categories.tsx.
  const [seen, setSeen] = useState<unknown>(null);
  if (fetcher.data !== seen) {
    setSeen(fetcher.data);
    if (fetcher.data?.ok) onDone();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-card">
      <fetcher.Form
        method="post"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-6 py-3"
      >
        <input type="hidden" name="intent" value="assignCategory" />
        {ids.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}

        <span className="text-sm font-medium">
          {t("assets.selectedCount", { count: ids.length })}
        </span>

        <span className="min-w-40 flex-1">
          <Select name="categoryId" aria-label={t("assets.assignTo")} required defaultValue="">
            {/* Segnaposto, non una scelta: `disabled` lo toglie dall'elenco e
                `required` sul menu impedisce di inviare senza aver scelto. */}
            <option value="" disabled>
              {t("assets.assignTo")}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value={CLEAR_CATEGORY}>{t("assets.noCategory")}</option>
          </Select>
        </span>

        <button type="submit" disabled={busy} className={buttonClass("primary")}>
          {t("assets.assign")}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className={buttonClass("plain")}
        >
          {t("assets.clearSelection")}
        </button>
      </fetcher.Form>
    </div>
  );
}

/** Gli oggetti già ordinati, spezzati in gruppi consecutivi per categoria. */
function groupsOf(assets: AssetRow[]) {
  const groups: Array<{ slug: string; name: string | null; assets: AssetRow[] }> = [];

  for (const asset of assets) {
    const slug = asset.category?.slug ?? NO_CATEGORY;
    const last = groups.at(-1);
    if (last?.slug === slug) last.assets.push(asset);
    else groups.push({ slug, name: asset.category?.name ?? null, assets: [asset] });
  }

  return groups;
}

/**
 * Le pasticche del filtro.
 *
 * Sono collegamenti e non pulsanti perché il filtro vive nell'indirizzo: si
 * aprono in una scheda nuova, si tengono nei segnalibri, e il tasto indietro
 * fa quello che ci si aspetta. La categoria attiva non si distingue solo per
 * colore — porta il bordo pieno d'accento e `aria-current`.
 */
function CategoryChips({
  categories,
  counts,
  total,
  active,
  archived,
  archivedCount,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  counts: Map<string, number>;
  total: number;
  active: string;
  archived: boolean;
  archivedCount: number;
}) {
  const t = useT();
  const orphans = counts.get(NO_CATEGORY) ?? 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        to="/admin/assets"
        label={t("assets.filterAll")}
        count={total}
        active={!active && !archived}
      />

      {/* Fra gli archiviati le categorie non si filtrano: quelle pasticche
          portano a `?cat=…`, cioè fuori di qui, e su roba che il catalogo non
          mostra più la categoria non risponde comunque a nessuna domanda. */}
      {!archived &&
        categories.map((category) => (
          <Chip
            key={category.id}
            to={`/admin/assets?cat=${encodeURIComponent(category.slug)}`}
            label={category.name}
            count={counts.get(category.slug) ?? 0}
            active={active === category.slug}
          />
        ))}

      {/* Compare solo se c'è davvero qualcosa da sistemare. */}
      {!archived && orphans > 0 && (
        <Chip
          to={`/admin/assets?cat=${NO_CATEGORY}`}
          label={t("assets.noCategory")}
          count={orphans}
          active={active === NO_CATEGORY}
        />
      )}

      {/* Staccata dalle altre: non è un altro modo di guardare il catalogo,
          è quello che dal catalogo è uscito. */}
      {archivedCount > 0 && (
        <Chip
          to="/admin/assets?archived=1"
          label={t("assets.archived")}
          count={archivedCount}
          active={archived}
          className="ml-auto"
        />
      )}
    </div>
  );
}

function Chip({
  to,
  label,
  count,
  active,
  className,
}: {
  to: string;
  label: string;
  count: number;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "true" : undefined}
      preventScrollReset
      className={[
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
        active
          ? "border-accent bg-accent-soft font-medium text-accent"
          : "border-rule text-muted hover:border-ink hover:text-ink",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
      <span className="font-mono text-2xs">{count}</span>
    </Link>
  );
}

function AssetItem({
  asset,
  showCategory = true,
  archived = false,
  chosen,
  onChoose,
}: {
  asset: AssetRow;
  showCategory?: boolean;
  archived?: boolean;
  /** `undefined` dove la selezione non ha senso: la spunta non compare. */
  chosen?: boolean;
  onChoose: (id: string) => void;
}) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  // Ottimista: mentre la richiesta è in volo si mostra già lo stato nuovo,
  // così il click sembra immediato invece di aspettare il giro col server.
  const pendingBookable =
    fetcher.state !== "idle" ? !asset.isBookable : asset.isBookable;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded border border-rule bg-card p-3">
      {chosen !== undefined && (
        <input
          type="checkbox"
          checked={chosen}
          onChange={() => onChoose(asset.id)}
          aria-label={asset.name}
          className="h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
      )}

      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-sunk">
        {asset.photos[0]?.thumbUrl && (
          <img
            src={asset.photos[0].thumbUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <Link to={`/admin/assets/${asset.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium hover:text-accent">{asset.name}</p>
        {showCategory && (
          <p className="font-mono text-2xs uppercase tracking-wider text-muted">
            {asset.category?.name ?? t("assets.noCategory")}
          </p>
        )}
      </Link>

      {/* Sul telefono l'interruttore scende su una riga sua. Accanto al nome
          non ci sta: «Segna non disponibile» è largo il doppio dello spazio
          che resta, e a rimetterci era il nome — «Cassa a…», cioè l'unica
          cosa per cui si è aperta la pagina. */}
      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        {archived ? (
          <span className="font-mono text-2xs uppercase tracking-wider text-muted">
            {t("assets.archivedBadge")}
          </span>
        ) : (
          <>
        {!pendingBookable && (
          <span className="font-mono text-2xs uppercase tracking-wider text-muted">
            {t("state.notBookable")}
          </span>
        )}

        <fetcher.Form method="post">
          <input type="hidden" name="id" value={asset.id} />
          <button type="submit" className={buttonClass("quiet", "sm")}>
            {pendingBookable ? t("assets.makeUnavailable") : t("assets.makeAvailable")}
          </button>
        </fetcher.Form>
          </>
        )}
      </div>
    </li>
  );
}
