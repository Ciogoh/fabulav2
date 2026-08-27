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
import { Button } from "~/components/button";
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

  // Nome oppure categoria: chi cerca «audio» pensa alla categoria, chi cerca
  // «SM58» pensa all'oggetto, e nessuno dei due vuole sapere quale dei due
  // campi sta interrogando.
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
          // Archiviato vuol dire «non è più roba nostra»: fuori dal catalogo,
          // fuori dal conteggio, fuori dai kit.
          archivedAt: null,
          ...(categorySlug ? { category: { slug: categorySlug } } : {}),
          ...search,
        },
        orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
        // Campo per campo, mai `include`: `location` e `adminNotes` non
        // devono poter finire in una risposta pubblica per distrazione.
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
    // I kit sono scorciatoie del catalogo intero: filtrarne uno a metà
    // darebbe un «kit audio» senza le casse. Spariscono quando si filtra.
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
      <FilterBar
        categories={categories}
        activeCategory={activeCategory}
        query={query}
      />

      <main>
        <PageShell className="pb-32 pt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {filtered
              ? t("catalogue.showingSome", {
                  count: assets.length,
                  total: totalAssets,
                })
              : t("catalogue.showingAll", { count: assets.length })}
          </p>

          {/* Una griglia sola per kit e oggetti: stessa larghezza di scheda,
              stessa colonna sinistra, nessun salto fra le due sezioni.
              `items-start` perché finché le foto sono poche una scheda con
              foto è alta il triplo delle altre: senza, le vicine si
              stiravano fino a diventare riquadri quasi vuoti. */}
          <div className="mt-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="mt-16 text-center text-muted">{t("catalogue.empty")}</p>
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
  // Campo controllato, ma il valore di partenza arriva dal server: così
  // tornando indietro col browser la casella mostra quello che sta filtrando.
  const [value, setValue] = useState(query);
  useEffect(() => setValue(query), [query]);

  /* Si cerca mentre si scrive, con un respiro: senza il ritardo ogni tasto
     sarebbe una richiesta al server. `replace` per non riempire la cronologia
     di uno stato per lettera — il tasto «indietro» deve riportare al catalogo
     intero, non a «SM5». */
  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => {
      if (formRef.current) {
        void submit(formRef.current, { replace: true });
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="border-b border-rule bg-card">
      <PageShell className="py-5 sm:py-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("catalogue.heading")}
        </h1>

        <form ref={formRef} method="get" className="mt-5 flex flex-wrap items-end gap-3">
          <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:max-w-xs">
            <label
              htmlFor="q"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
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
              className="min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cat"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
            >
              {t("catalogue.category")}
            </label>
            <Select
              id="cat"
              name="cat"
              defaultValue={activeCategory}
              onChange={(event) => submit(event.currentTarget.form, { replace: true })}
            >
              <option value="">{t("catalogue.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Senza JavaScript resta un modulo normale che si manda con Invio. */}
          <noscript>
            <button
              type="submit"
              className="min-h-11 rounded border border-accent px-4 text-sm font-medium text-accent"
            >
              {t("catalogue.search")}
            </button>
          </noscript>

          {(activeCategory || query) && (
            <Link
              to="/"
              className="inline-flex min-h-11 items-center px-1 text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t("catalogue.clearFilter")}
            </Link>
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
    IN_USE: "bg-out",
    UNAVAILABLE: "bg-out",
    NOT_BOOKABLE:
      "bg-[repeating-linear-gradient(90deg,var(--idle)_0_6px,transparent_6px_12px)]",
  };

  return (
    <article className="relative flex flex-col overflow-hidden rounded border border-rule bg-card focus-within:border-accent hover:border-accent">
      <span aria-hidden="true" className={`h-[3px] w-full ${STRIPE[visual]}`} />
      {photo && (
        <img
          src={photo}
          alt=""
          className="aspect-4/3 w-full bg-sunk object-cover"
          loading="lazy"
        />
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          {/* Senza foto, un monogramma piccolo di fianco al titolo. Prima era
              un rettangolo 4:3 grigio: l'elemento più grande della scheda per
              l'informazione minore della pagina. */}
          {!photo && (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-sunk font-serif text-lg text-faint"
            >
              {initialsOf(asset.name)}
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-1">
            {asset.category && (
              <span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">
                {asset.category.name}
              </span>
            )}

            <h2 className="text-[0.95rem] font-semibold leading-snug">
              {/* Il collegamento copre tutta la scheda tramite lo pseudo
                  elemento; i pulsanti sotto stanno sopra di lui con `z-10`,
                  così restano cliccabili. */}
              <Link
                to={`/items/${asset.id}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {asset.name}
              </Link>
            </h2>
          </div>
        </div>

        <div className="mt-auto pt-2">
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
            className="relative z-10 mt-3 w-full"
            onClick={onRemove}
          >
            {t("cart.remove")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="relative z-10 mt-3 w-full"
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
    <article className="flex flex-col rounded border border-rule bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-accent">
          {t("kit.badge")}
        </span>
        <span className="font-mono text-[0.7rem] text-muted">
          {t("kit.itemCount", { count: members.length })}
        </span>
      </div>

      <h2 className="mt-2 font-serif text-lg font-semibold">{kit.name}</h2>
      {kit.description && (
        <p className="mt-1 text-sm text-muted">{kit.description}</p>
      )}

      <ul className="mt-3 flex-1 border-t border-rule pt-3 text-sm">
        {shown.map((member) => (
          <li
            key={member.id}
            className={
              canAdd(member.id)
                ? "py-0.5"
                : "py-0.5 text-muted line-through decoration-1"
            }
          >
            {/* `inline-block py-1`: da riga di testo a bersaglio da toccare —
                l'elenco dei pezzi di un kit è fatto di collegamenti, e a
                venti pixel di altezza col pollice si sbaglia. */}
            <Link
              to={`/items/${member.id}`}
              className="inline-block py-1 hover:text-accent"
            >
              {member.name}
            </Link>
          </li>
        ))}
        {hidden > 0 && (
          <li className="py-0.5 text-muted">{t("kit.more", { count: hidden })}</li>
        )}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        className="mt-4 w-full"
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
