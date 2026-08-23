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
 */

import { useMemo, useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.assets";
import { PageShell, PageTitle } from "~/components/page";
import { buttonClass, ButtonLink } from "~/components/button";
import { AdminTabs } from "~/components/admin-tabs";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "assets.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const [assets, categories] = await Promise.all([
    db.asset.findMany({
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
  ]);

  return { assets, categories };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");

  const asset = await db.asset.findUnique({ where: { id }, select: { isBookable: true } });
  if (!asset) return { ok: false as const };

  await db.asset.update({ where: { id }, data: { isBookable: !asset.isBookable } });
  return { ok: true as const };
}

type AssetRow = Route.ComponentProps["loaderData"]["assets"][number];

/** Il gruppo degli oggetti senza categoria, che nell'indirizzo si scrive così. */
const NO_CATEGORY = "-";

export default function AdminAssets({ loaderData }: Route.ComponentProps) {
  const { assets, categories } = loaderData;
  const t = useT();

  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat") ?? "";
  const [query, setQuery] = useState("");

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

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
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
                className="min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"
              />

              <CategoryChips
                categories={categories}
                counts={counts}
                total={assets.length}
                active={activeCategory}
              />
            </div>

            {visible.length === 0 ? (
              <p className="mt-16 text-center text-muted">{t("assets.noneFound")}</p>
            ) : grouped ? (
              <div className="mt-6 flex flex-col gap-6">
                {groupsOf(visible).map((group) => (
                  <section key={group.slug}>
                    <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                      {group.name ?? t("assets.noCategory")}
                      <span className="ml-2 tabular-nums">{group.assets.length}</span>
                    </h2>
                    <ul className="mt-2 flex flex-col gap-2">
                      {group.assets.map((asset) => (
                        /* Dentro a un gruppo la categoria è già scritta
                           sopra: ripeterla sotto ogni nome è la stessa
                           parola otto volte di fila. */
                        <AssetItem key={asset.id} asset={asset} showCategory={false} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="mt-6 flex flex-col gap-2">
                {visible.map((asset) => (
                  <AssetItem key={asset.id} asset={asset} />
                ))}
              </ul>
            )}
          </>
        )}
      </PageShell>
    </main>
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
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  counts: Map<string, number>;
  total: number;
  active: string;
}) {
  const t = useT();
  const orphans = counts.get(NO_CATEGORY) ?? 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip to="/admin/assets" label={t("assets.filterAll")} count={total} active={!active} />

      {categories.map((category) => (
        <Chip
          key={category.id}
          to={`/admin/assets?cat=${encodeURIComponent(category.slug)}`}
          label={category.name}
          count={counts.get(category.slug) ?? 0}
          active={active === category.slug}
        />
      ))}

      {/* Compare solo se c'è davvero qualcosa da sistemare. */}
      {orphans > 0 && (
        <Chip
          to={`/admin/assets?cat=${NO_CATEGORY}`}
          label={t("assets.noCategory")}
          count={orphans}
          active={active === NO_CATEGORY}
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
}: {
  to: string;
  label: string;
  count: number;
  active: boolean;
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
      ].join(" ")}
    >
      {label}
      <span className="font-mono text-[0.65rem]">{count}</span>
    </Link>
  );
}

function AssetItem({
  asset,
  showCategory = true,
}: {
  asset: AssetRow;
  showCategory?: boolean;
}) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  // Ottimista: mentre la richiesta è in volo si mostra già lo stato nuovo,
  // così il click sembra immediato invece di aspettare il giro col server.
  const pendingBookable =
    fetcher.state !== "idle" ? !asset.isBookable : asset.isBookable;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded border border-rule bg-card p-3">
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
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            {asset.category?.name ?? t("assets.noCategory")}
          </p>
        )}
      </Link>

      {/* Sul telefono l'interruttore scende su una riga sua. Accanto al nome
          non ci sta: «Segna non disponibile» è largo il doppio dello spazio
          che resta, e a rimetterci era il nome — «Cassa a…», cioè l'unica
          cosa per cui si è aperta la pagina. */}
      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        {!pendingBookable && (
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            {t("state.notBookable")}
          </span>
        )}

        <fetcher.Form method="post">
          <input type="hidden" name="id" value={asset.id} />
          <button type="submit" className={buttonClass("quiet", "sm")}>
            {pendingBookable ? t("assets.makeUnavailable") : t("assets.makeAvailable")}
          </button>
        </fetcher.Form>
      </div>
    </li>
  );
}
