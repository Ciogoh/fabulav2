/**
 * Il catalogo — la prima cosa che si vede, senza account.
 *
 * La scelta di progetto che conta: **le date si scelgono dopo, non prima**.
 * Si sfoglia il catalogo — che mostra solo lo stato di oggi — si mettono
 * oggetti nel carrello, e le date si indicano una volta sola premendo
 * «Richiedi». L'alternativa (due campi data in cima che filtrano la griglia)
 * costringeva a ripensare le date prima ancora di sapere cosa si vuole
 * prendere, ed è il motivo per cui un oggetto occupato oggi ma libero fra due
 * settimane risultava introvabile.
 *
 * Tre cose sono cambiate dopo averlo guardato col telefono in mano:
 *
 * - **C'è la ricerca.** Ventuno oggetti si sfogliano; sessanta no, e in
 *   magazzino si vuole scrivere «SM58» invece di scorrere. Il filtro per
 *   categoria da solo non ci arriva.
 * - **La scheda è un collegamento.** La descrizione scritta dagli admin non
 *   si leggeva da nessuna parte e la foto non si ingrandiva.
 * - **Una griglia sola.** I kit stavano in una griglia a due colonne sopra
 *   una griglia a tre: due larghezze di scheda diverse, una sotto l'altra.
 */

import { Link, useSearchParams, useSubmit } from "react-router";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/catalogue";
import { db } from "~/lib/db.server";
import {
  formatDay,
  getCurrentAvailability,
  todayUtc,
  type AssetAvailability,
} from "~/lib/availability.server";
import { getUser } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";
import { initialsOf } from "~/lib/initials";
import { pageTitle, tagline } from "~/i18n/meta";
import { StateBadge, visualStateOf } from "~/components/state-badge";
import { PageShell } from "~/components/page";
import { Select } from "~/components/select";
import { Button, ButtonLink } from "~/components/button";
import { CartBar } from "~/components/cart-bar";
import { useCart, type CartEntry } from "~/lib/use-cart";

export function meta({ matches }: Route.MetaArgs) {
  return [
    { title: pageTitle(matches, "catalogue.heading") },
    { name: "description", content: tagline(matches) },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("cat");
  const query = (url.searchParams.get("q") ?? "").trim();

  const search = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          {
            category: {
              name: { contains: query, mode: "insensitive" as const },
            },
          },
        ],
      }
    : {};

  const [categories, assets, kits, user, current, totalAssets] =
    await Promise.all([
      db.category.findMany({ orderBy: { sortOrder: "asc" } }),
      db.asset.findMany({
        where: {
          archivedAt: null,
          ...(categorySlug ? { category: { slug: categorySlug } } : {}),
          ...search,
        },
        orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          isBookable: true,
          category: { select: { name: true, slug: true } },
          photos: {
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { thumbUrl: true },
          },
        },
      }),
      db.kit.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          assets: {
            where: { asset: { archivedAt: null } },
            orderBy: { sortOrder: "asc" },
            select: { asset: { select: { id: true, name: true } } },
          },
        },
      }),
      getUser(request),
      getCurrentAvailability(),
      db.asset.count({ where: { archivedAt: null } }),
    ]);

  const availability: Record<string, AssetAvailability> = Object.fromEntries(
    assets.map((asset) => [
      asset.id,
      current.get(asset.id) ?? { state: "FREE" as const, until: null, from: null },
    ])
  );

  return {
    assets,
    kits: categorySlug || query ? [] : kits,
    categories,
    availability,
    totalAssets,
    query,
    today: formatDay(todayUtc()),
    user: user ? { name: user.name } : null,
  };
}

export default function Catalogue({ loaderData }: Route.ComponentProps) {
  const { assets, kits, categories, availability, totalAssets, query, today, user } =
    loaderData;
  const t = useT();
  const [searchParams] = useSearchParams();
  const cart = useCart();

  const activeCategory = searchParams.get("cat") ?? "";
  const filtered = Boolean(activeCategory || query);
  const bookableIds = new Set(
    assets.filter((asset) => asset.isBookable).map((asset) => asset.id)
  );

  return (
    <>
      <div id="catalogo">
        <FilterBar
          categories={categories}
          activeCategory={activeCategory}
          query={query}
        />
      </div>

      <main className="bg-[#FFF6E8]">
        <PageShell className="pb-32 pt-8">
          <p className="eyebrow text-[#2B0016]">
            {filtered
              ? t("catalogue.showingSome", {
                  count: assets.length,
                  total: totalAssets,
                })
              : t("catalogue.showingAll", { count: assets.length })}
          </p>

          <div className="mt-6 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => (
              <KitCard
                key={kit.id}
                kit={kit}
                canAdd={(id) => bookableIds.has(id)}
                onAdd={cart.add}
              />
            ))}

            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                availability={availability[asset.id]!}
                today={today}
                inCart={cart.has(asset.id)}
                onAdd={() => cart.add({ assetId: asset.id, name: asset.name })}
                onRemove={() => cart.remove(asset.id)}
              />
            ))}
          </div>

          {assets.length === 0 && (
            <p className="mt-16 text-center text-muted font-mono">{t("catalogue.empty")}</p>
          )}
        </PageShell>
      </main>

      <CartBar cart={cart} today={today} user={user} />
    </>
  );
}

/* ------------------------------------------------------------- filtri */

function FilterBar({
  categories,
  activeCategory,
  query,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  activeCategory: string;
  query: string;
}) {
  const t = useT();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(query);
  useEffect(() => setValue(query), [query]);

  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => {
      if (formRef.current) {
        void submit(formRef.current, { replace: true });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="border-y-2 border-[#2B0016] bg-[#FFAC00] text-[#2B0016]">
      <PageShell className="py-5 sm:py-6">
        <h1 className="font-mono text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#2B0016]">
          {t("catalogue.heading")}
        </h1>

        <form ref={formRef} method="get" className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex min-w-44 flex-1 flex-col gap-1.5 sm:max-w-xs">
            <label
              htmlFor="q"
              className="font-mono text-xs uppercase tracking-wider text-[#2B0016] font-semibold"
            >
              {t("catalogue.search")}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              value={value}
              placeholder={t("catalogue.searchPlaceholder")}
              onChange={(event) => setValue(event.target.value)}
              className="field border-2 border-[#2B0016] bg-white font-mono placeholder:text-[#2B0016]/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cat"
              className="font-mono text-xs uppercase tracking-wider text-[#2B0016] font-semibold"
            >
              {t("catalogue.category")}
            </label>
            <Select
              id="cat"
              name="cat"
              defaultValue={activeCategory}
              onChange={(event) => submit(event.currentTarget.form, { replace: true })}
              className="border-2 border-[#2B0016] bg-white font-mono text-sm"
            >
              <option value="">{t("catalogue.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          {(activeCategory || query) && (
            <ButtonLink
              to="/catalogue"
              variant="plain"
              className="font-mono text-sm font-semibold uppercase underline hover:text-[#E00069]"
            >
              {t("catalogue.clearFilter")}
            </ButtonLink>
          )}
        </form>
      </PageShell>
    </div>
  );
}

/* -------------------------------------------------------------- schede */

type AssetRow = Route.ComponentProps["loaderData"]["assets"][number];

function AssetCard({
  asset,
  availability,
  today,
  inCart,
  onAdd,
  onRemove,
}: {
  asset: AssetRow;
  availability: AssetAvailability;
  today: string;
  inCart: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  // Occupato *oggi* non vuol dire indisponibile: le date si scelgono dopo,
  // premendo «Richiedi», e lì si verifica il periodo scelto davvero.
  const canAdd = asset.isBookable;
  const photo = asset.photos[0]?.thumbUrl;

  /* La fascia in cima alla scheda porta lo stato **senza parole**: scorrendo
     una griglia di venti si vede quali sono libere senza leggerne nessuna. Il
     colore lo decide la stessa funzione del badge, o la scheda direbbe una
     cosa e la pastiglia dentro un'altra. Tratteggiata per «non prestabile»:
     non è un allarme, è assenza di gioco. */
  const visual = asset.isBookable
    ? visualStateOf(availability.state, availability.from)
    : "NOT_BOOKABLE";
  const STRIPE: Record<typeof visual, string> = {
    FREE: "bg-free",
    RESERVED: "bg-held",
    IN_USE: "bg-out",
    UNAVAILABLE: "bg-out",
    NOT_BOOKABLE:
      "bg-[repeating-linear-gradient(90deg,var(--idle)_0_6px,transparent_6px_12px)]",
  };

  return (
    /* **Il contorno di fuoco stava intorno alla parola sbagliata.** Il
       collegamento è il titolo, ma la sua area cliccabile è tutta la scheda
       (lo pseudo elemento `after`): arrivando col Tab, il browser disegnava
       l'anello intorno alle due righe del nome — un rettangolo grande un
       decimo di quello che si sta per aprire. Qui l'anello lo porta la
       scheda, e il titolo rinuncia al suo; `a:focus-visible` e non
       `focus-within`, o si accenderebbe anche al click del mouse e su
       «Aggiungi», che il suo anello ce l'ha già. */
    <article className="relative flex flex-col overflow-hidden rounded-none border-2 border-[#2B0016] bg-white shadow-[4px_4px_0px_#2b0016] hover:shadow-[6px_6px_0px_#2b0016] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[#E00069]">
      <span aria-hidden="true" className={`h-1.5 w-full border-b border-[#2B0016] ${STRIPE[visual]}`} />
      {photo && (
        <div className="border-b border-[#2B0016]">
          <img
            src={photo}
            alt=""
            className="aspect-4/3 w-full bg-[#FFE9C2]/30 object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          {!photo && (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-[#2B0016] bg-[#FFE9C2] font-mono text-lg font-bold text-[#2B0016]"
            >
              {initialsOf(asset.name)}
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-1">
            {asset.category && (
              <span className="font-mono text-2xs uppercase tracking-wider text-[#7A5C68] font-medium">
                {asset.category.name}
              </span>
            )}

            <h2 className="text-base font-semibold leading-snug text-[#2B0016]">
              <Link
                to={`/items/${asset.id}`}
                className="focus-visible:outline-none after:absolute after:inset-0 after:content-[''] hover:text-[#E00069] transition-colors"
              >
                {asset.name}
              </Link>
            </h2>
          </div>
        </div>

        <div className="mt-auto pt-3">
          {asset.isBookable ? (
            <StateBadge
              state={availability.state}
              until={availability.until}
              from={availability.from}
              today={today}
              tone="solid"
            />
          ) : (
            <StateBadge state="NOT_BOOKABLE" today={today} tone="solid" />
          )}
        </div>

        {inCart ? (
          <Button
            variant="danger"
            size="sm"
            className="relative z-10 mt-3 w-full border-2 border-[#2B0016] font-mono uppercase"
            onClick={onRemove}
          >
            {t("cart.remove")}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="relative z-10 mt-3 w-full border-2 border-[#2B0016] font-mono uppercase shadow-[2px_2px_0px_#2b0016]"
            disabled={!canAdd}
            onClick={onAdd}
          >
            {t("cart.add")}
          </Button>
        )}
      </div>
    </article>
  );
}

type KitRow = Route.ComponentProps["loaderData"]["kits"][number];

/** Oltre questi, l'elenco del kit si accorcia: cinque righe di nomi sono più
 * alte di tutto il resto della scheda messo insieme. */
const KIT_PREVIEW = 4;

/**
 * Un kit è una scorciatoia, non un tipo di prenotazione a sé: quando lo si
 * aggiunge finisce nel carrello **sciolto nei suoi pezzi**, che da lì si
 * possono togliere uno a uno. Per questo `Kit` non compare da nessuna parte
 * nel calcolo della disponibilità.
 */
function KitCard({
  kit,
  canAdd,
  onAdd,
}: {
  kit: KitRow;
  canAdd: (assetId: string) => boolean;
  onAdd: (entries: CartEntry[]) => void;
}) {
  const t = useT();
  const members = kit.assets.map((link) => link.asset);
  const available = members.filter((member) => canAdd(member.id));
  const shown = members.slice(0, KIT_PREVIEW);
  const hidden = members.length - shown.length;

  return (
    <article className="flex flex-col rounded-none border-2 border-[#2B0016] bg-white p-4 shadow-[4px_4px_0px_#2b0016] hover:shadow-[6px_6px_0px_#2b0016] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150">
      <div className="flex items-center gap-2">
        <span className="rounded-none border border-[#2B0016] bg-[#FFAC00] px-2 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider text-[#2B0016]">
          {t("kit.badge")}
        </span>
        <span className="font-mono text-2xs text-[#7A5C68] font-medium">
          {t("kit.itemCount", { count: members.length })}
        </span>
      </div>

      <h2 className="mt-2 font-mono text-lg font-bold text-[#2B0016]">{kit.name}</h2>
      {kit.description && (
        <p className="mt-1 text-sm text-[#2B0016]/80">{kit.description}</p>
      )}

      <ul className="mt-3 flex-1 border-t-2 border-[#2B0016] pt-3 text-sm">
        {shown.map((member) => {
          const usable = canAdd(member.id);
          return (
            <li
              key={member.id}
              className={usable ? "py-0.5" : "flex flex-wrap items-baseline gap-x-2 py-0.5"}
            >
              <Link
                to={`/items/${member.id}`}
                className={
                  usable
                    ? "inline-block py-1 font-medium hover:text-[#E00069] transition-colors"
                    : "inline-block py-1 text-muted line-through decoration-1 hover:text-[#E00069]"
                }
              >
                {member.name}
              </Link>
              {!usable && (
                <span className="font-mono text-2xs uppercase tracking-wider text-muted">
                  {t("state.notBookable")}
                </span>
              )}
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="py-0.5 font-mono text-2xs text-muted">
            {t("kit.more", { count: hidden })}
          </li>
        )}
      </ul>

      <Button
        variant="primary"
        size="sm"
        className="mt-4 w-full border-2 border-[#2B0016] font-mono uppercase shadow-[2px_2px_0px_#2b0016]"
        disabled={available.length === 0}
        onClick={() =>
          onAdd(
            available.map((member) => ({
              assetId: member.id,
              name: member.name,
              fromKitId: kit.id,
              fromKitName: kit.name,
            }))
          )
        }
      >
        {t("cart.add")}
      </Button>
    </article>
  );
}
