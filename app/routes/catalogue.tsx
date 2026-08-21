/**
 * Il catalogo — la prima cosa che si vede, senza account.
 *
 * La scelta di progetto che conta: **le date si scelgono prima, non dopo**.
 * In cima ci sono due campi data e la griglia si filtra da sola. L'alternativa
 * istintiva — aprire ogni oggetto per guardarne il calendario — costringe ad
 * aprire dieci schede per capire cosa è libero un dato fine settimana, ed è
 * ciò che rende faticose queste piattaforme.
 */

import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/catalogue";
import { db } from "~/lib/db.server";
import {
  FREE,
  formatDay,
  getBusyAssetIds,
  getCurrentAvailability,
  parseDay,
  todayUtc,
  type AssetAvailability,
} from "~/lib/availability.server";
import { useFormatDay, useT } from "~/i18n/use-t";
import { StateBadge } from "~/components/state-badge";
import { useCart, type CartEntry } from "~/lib/use-cart";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const from = parseDay(url.searchParams.get("from"));
  const to = parseDay(url.searchParams.get("to"));
  const categorySlug = url.searchParams.get("cat");

  // Un periodo vale solo se completo e nel verso giusto.
  const range = from && to && to >= from ? { from, to } : null;
  const datesInvalid = Boolean(from && to && to < from);

  const [categories, assets, kits] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.asset.findMany({
      where: categorySlug ? { category: { slug: categorySlug } } : undefined,
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
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
          orderBy: { sortOrder: "asc" },
          select: { asset: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  // Due modi di leggere la disponibilità: dentro a un periodo scelto è una
  // domanda sì/no; senza periodo si mostra lo stato di oggi.
  let availability: Record<string, AssetAvailability>;

  if (range) {
    const busy = await getBusyAssetIds(range.from, range.to);
    availability = Object.fromEntries(
      assets.map((asset) => [
        asset.id,
        busy.has(asset.id)
          ? { state: "UNAVAILABLE" as const, until: null, from: null }
          : FREE,
      ])
    );
  } else {
    const current = await getCurrentAvailability();
    availability = Object.fromEntries(
      assets.map((asset) => [asset.id, current.get(asset.id) ?? FREE])
    );
  }

  const freeCount = assets.filter(
    (asset) => asset.isBookable && availability[asset.id].state === "FREE"
  ).length;

  return {
    assets,
    kits,
    categories,
    availability,
    freeCount,
    datesInvalid,
    today: formatDay(todayUtc()),
    range: range
      ? { from: formatDay(range.from), to: formatDay(range.to) }
      : null,
  };
}

export default function Catalogue({ loaderData }: Route.ComponentProps) {
  const {
    assets,
    kits,
    categories,
    availability,
    freeCount,
    datesInvalid,
    today,
    range,
  } = loaderData;
  const t = useT();
  const formatDay = useFormatDay();
  const [searchParams] = useSearchParams();
  const cart = useCart();

  const activeCategory = searchParams.get("cat") ?? "";
  const bookable = (id: string) => availability[id]?.state === "FREE";

  return (
    <>
      <FilterBar
        today={today}
        range={range}
        categories={categories}
        activeCategory={activeCategory}
        datesInvalid={datesInvalid}
      />

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-faint">
          {range
            ? t("catalogue.showingFree", {
                count: freeCount,
                total: assets.length,
                from: formatDay(range.from),
                to: formatDay(range.to),
              })
            : t("catalogue.showingAll", { count: assets.length })}
        </p>

        {kits.length > 0 && !activeCategory && (
          <section className="mt-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {kits.map((kit) => (
                <KitCard
                  key={kit.id}
                  kit={kit}
                  canAdd={(id) => bookable(id)}
                  onAdd={cart.add}
                />
              ))}
            </div>
          </section>
        )}

        {assets.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("catalogue.empty")}</p>
        ) : (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                availability={availability[asset.id]}
                inCart={cart.has(asset.id)}
                onAdd={() => cart.add({ assetId: asset.id, name: asset.name })}
                onRemove={() => cart.remove(asset.id)}
              />
            ))}
          </section>
        )}
      </main>

      <CartBar cart={cart} hasDates={Boolean(range)} />
    </>
  );
}

/* ------------------------------------------------------------- filtri */

function FilterBar({
  today,
  range,
  categories,
  activeCategory,
  datesInvalid,
}: {
  today: string;
  range: { from: string; to: string } | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  activeCategory: string;
  datesInvalid: boolean;
}) {
  const t = useT();

  return (
    <div className="border-b border-rule bg-card">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("catalogue.heading")}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          {t("catalogue.datesHint")}
        </p>

        <Form method="get" className="mt-5 flex flex-wrap items-end gap-3">
          <Field label={t("catalogue.from")} name="from" min={today} value={range?.from} />
          <Field
            label={t("catalogue.to")}
            name="to"
            min={range?.from ?? today}
            value={range?.to}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cat"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
            >
              {t("catalogue.allCategories")}
            </label>
            <select
              id="cat"
              name="cat"
              defaultValue={activeCategory}
              className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              <option value="">{t("catalogue.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          >
            {t("catalogue.checkDates")}
          </button>

          {(range || activeCategory) && (
            <a
              href="/"
              className="px-2 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t("catalogue.clearDates")}
            </a>
          )}
        </Form>

        {datesInvalid && (
          <p role="alert" className="mt-3 text-sm text-out">
            {t("catalogue.endBeforeStart")}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  min,
  value,
}: {
  label: string;
  name: string;
  min: string;
  value?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="date"
        min={min}
        defaultValue={value ?? ""}
        className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
      />
    </div>
  );
}

/* -------------------------------------------------------------- schede */

type AssetRow = Route.ComponentProps["loaderData"]["assets"][number];

function AssetCard({
  asset,
  availability,
  inCart,
  onAdd,
  onRemove,
}: {
  asset: AssetRow;
  availability: AssetAvailability;
  inCart: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const state = availability.state;
  const canAdd = asset.isBookable && state === "FREE";

  return (
    <article className="flex flex-col overflow-hidden rounded border border-rule bg-card">
      <Thumbnail name={asset.name} url={asset.photos[0]?.thumbUrl} />

      <div className="flex flex-1 flex-col gap-2 p-4">
        {asset.category && (
          <span className="font-mono text-[0.66rem] uppercase tracking-widest text-faint">
            {asset.category.name}
          </span>
        )}

        <h3 className="text-[0.95rem] font-semibold leading-snug">
          {asset.name}
        </h3>

        <div className="mt-auto pt-2">
          {asset.isBookable ? (
            <StateBadge
              state={state}
              until={availability.until}
              from={availability.from}
            />
          ) : (
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
              {t("state.notBookable")}
            </span>
          )}
        </div>

        {inCart ? (
          <button
            type="button"
            onClick={onRemove}
            className="mt-3 rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-out hover:text-out"
          >
            {t("cart.remove")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            className="mt-3 rounded border border-accent px-3 py-1.5 text-sm font-medium text-accent enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:border-rule disabled:text-faint"
          >
            {t("cart.add")}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Finché non ci sono foto caricate, un monogramma. Meglio di un'icona grigia
 * uguale per tutti: dà comunque un appiglio visivo per distinguere le schede.
 */
function Thumbnail({ name, url }: { name: string; url?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="aspect-4/3 w-full bg-sunk object-cover"
        loading="lazy"
      />
    );
  }

  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      aria-hidden="true"
      className="flex aspect-4/3 w-full items-center justify-center bg-sunk font-serif text-4xl text-faint"
    >
      {initials}
    </div>
  );
}

type KitRow = Route.ComponentProps["loaderData"]["kits"][number];

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

  return (
    <article className="rounded border border-rule bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-accent">
          {t("kit.badge")}
        </span>
        <span className="font-mono text-[0.7rem] text-faint">
          {t("kit.itemCount", { count: members.length })}
        </span>
      </div>

      <h3 className="mt-2 font-serif text-lg font-semibold">{kit.name}</h3>
      {kit.description && (
        <p className="mt-1 text-sm text-muted">{kit.description}</p>
      )}

      <ul className="mt-3 border-t border-rule pt-3 text-sm">
        {members.map((member) => (
          <li
            key={member.id}
            className={
              canAdd(member.id)
                ? "py-0.5"
                : "py-0.5 text-faint line-through decoration-1"
            }
          >
            {member.name}
          </li>
        ))}
      </ul>

      <button
        type="button"
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
        className="mt-4 w-full rounded border border-accent px-3 py-1.5 text-sm font-medium text-accent enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:border-rule disabled:text-faint"
      >
        {t("cart.add")}
      </button>
    </article>
  );
}

/* ------------------------------------------------------------ carrello */

function CartBar({
  cart,
  hasDates,
}: {
  cart: ReturnType<typeof useCart>;
  hasDates: boolean;
}) {
  const t = useT();

  if (!cart.ready || cart.entries.length === 0) return null;

  return (
    <div className="sticky bottom-0 border-t border-rule bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-faint">
            {t("cart.heading")}
          </p>
          <p className="truncate text-sm">
            {cart.entries.map((entry) => entry.name).join(" · ")}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={cart.clear}
            className="text-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            {t("cart.clear")}
          </button>
          <button
            type="submit"
            disabled={!hasDates}
            title={hasDates ? undefined : t("cart.needDates")}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-sunk disabled:text-faint"
          >
            {t("cart.submit")} ({cart.entries.length})
          </button>
        </div>
      </div>
    </div>
  );
}
