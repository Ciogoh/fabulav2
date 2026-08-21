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
 */

import { useEffect, useState } from "react";
import { Form, Link, useFetcher, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/catalogue";
import type { action as createRequestAction } from "./requests";
import { db } from "~/lib/db.server";
import {
  formatDay,
  getCurrentAvailability,
  todayUtc,
  type AssetAvailability,
} from "~/lib/availability.server";
import { getUser } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";
import { StateBadge } from "~/components/state-badge";
import { useCart, type CartEntry } from "~/lib/use-cart";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("cat");

  const [categories, assets, kits, user, current] = await Promise.all([
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
    getUser(request),
    getCurrentAvailability(),
  ]);

  const availability: Record<string, AssetAvailability> = Object.fromEntries(
    assets.map((asset) => [
      asset.id,
      current.get(asset.id) ?? { state: "FREE" as const, until: null, from: null },
    ])
  );

  return {
    assets,
    kits,
    categories,
    availability,
    today: formatDay(todayUtc()),
    user: user ? { name: user.name } : null,
  };
}

export default function Catalogue({ loaderData }: Route.ComponentProps) {
  const { assets, kits, categories, availability, today, user } = loaderData;
  const t = useT();
  const [searchParams] = useSearchParams();
  const cart = useCart();

  const activeCategory = searchParams.get("cat") ?? "";
  const bookableIds = new Set(
    assets.filter((asset) => asset.isBookable).map((asset) => asset.id)
  );

  return (
    <>
      <FilterBar categories={categories} activeCategory={activeCategory} />

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-faint">
          {t("catalogue.showingAll", { count: assets.length })}
        </p>

        {kits.length > 0 && !activeCategory && (
          <section className="mt-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {kits.map((kit) => (
                <KitCard
                  key={kit.id}
                  kit={kit}
                  canAdd={(id) => bookableIds.has(id)}
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

      <CartBar cart={cart} today={today} user={user} />
    </>
  );
}

/* ------------------------------------------------------------- filtri */

function FilterBar({
  categories,
  activeCategory,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  activeCategory: string;
}) {
  const t = useT();

  return (
    <div className="border-b border-rule bg-card">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("catalogue.heading")}
        </h1>

        <Form method="get" className="mt-5 flex flex-wrap items-end gap-3">
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
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
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

          {activeCategory && (
            <a
              href="/"
              className="px-2 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t("catalogue.clearFilter")}
            </a>
          )}
        </Form>
      </div>
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
  // Occupato *oggi* non vuol dire indisponibile: le date si scelgono dopo,
  // premendo «Richiedi», e lì si verifica il periodo scelto davvero.
  const canAdd = asset.isBookable;

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
  today,
  user,
}: {
  cart: ReturnType<typeof useCart>;
  today: string;
  user: { name: string } | null;
}) {
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);

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

          {user ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              {t("cart.submit")} ({cart.entries.length})
            </button>
          ) : (
            <Link
              to="/signin?next=/"
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              {t("cart.submit")} ({cart.entries.length})
            </Link>
          )}
        </div>
      </div>

      {dialogOpen && (
        <RequestDialog
          entries={cart.entries}
          today={today}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            cart.clear();
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------- richiesta */

/** `2026-09-03` spostato di `days` giorni, restando su giorni interi UTC. */
function shiftDayString(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}

function RequestDialog({
  entries,
  today,
  onClose,
  onSuccess,
}: {
  entries: CartEntry[];
  today: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof createRequestAction>();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [longer, setLonger] = useState(false);
  const [purpose, setPurpose] = useState("");

  const maxTo = longer ? undefined : shiftDayString(from, 6);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok) {
        onSuccess();
        navigate(`/requests/${fetcher.data.id}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const result = fetcher.data && !fetcher.data.ok ? fetcher.data : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t border border-rule bg-card p-5 sm:rounded">
        <h2 className="font-serif text-xl font-semibold">
          {t("request.heading")}
        </h2>

        <ul className="mt-3 max-h-24 overflow-y-auto text-sm text-muted">
          {entries.map((entry) => (
            <li key={entry.assetId}>{entry.name}</li>
          ))}
        </ul>

        <fetcher.Form
          method="post"
          action="/requests"
          className="mt-5 flex flex-col gap-4"
        >
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(
              entries.map((entry) => ({
                assetId: entry.assetId,
                fromKitId: entry.fromKitId,
              }))
            )}
          />

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="from"
                className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
              >
                {t("request.from")}
              </label>
              <input
                id="from"
                name="from"
                type="date"
                min={today}
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  if (to < event.target.value) setTo(event.target.value);
                }}
                className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="to"
                className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
              >
                {t("request.to")}
              </label>
              <input
                id="to"
                name="to"
                type="date"
                min={from}
                max={maxTo}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </div>
          </div>

          <p className="text-[0.8rem] text-muted">{t("request.maxSpan")}</p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="longer"
              value="1"
              checked={longer}
              onChange={(event) => setLonger(event.target.checked)}
              className="h-4 w-4"
            />
            {t("request.longer")}
          </label>

          {longer && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="purpose"
                className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
              >
                {t("request.purpose")}
              </label>
              <textarea
                id="purpose"
                name="purpose"
                rows={3}
                required
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              />
            </div>
          )}

          {result && (
            <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
              {t(result.error)}
              {result.conflicts && result.conflicts.length > 0 && (
                <> — {result.conflicts.join(", ")}</>
              )}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t("request.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:bg-sunk disabled:text-faint"
            >
              {t("request.submit")}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}
