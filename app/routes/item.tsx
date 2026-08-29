/**
 * La scheda di un oggetto.
 *
 * Prima non esisteva: nel catalogo la scheda non era un collegamento, quindi
 * la descrizione scritta dagli admin non si leggeva da nessuna parte, la foto
 * non si ingrandiva, e per sapere quando un oggetto tornava libero bisognava
 * andare sul calendario e cercarne la riga.
 *
 * Pubblica come il catalogo, con gli stessi limiti: **`location` e
 * `adminNotes` non escono da qui**, e le prenotazioni si vedono come date
 * senza nomi. Chi le ha in mano lo sa solo l'admin, dalla coda delle
 * richieste. I `select` sono scritti campo per campo di proposito: con un
 * `include` una colonna aggiunta domani finirebbe fuori da sola.
 */

import { useState } from "react";
import type { Route } from "./+types/item";
import { db } from "~/lib/db.server";
import {
  FREE,
  formatDay,
  getCurrentAvailability,
  getOccupancy,
  todayUtc,
} from "~/lib/availability.server";
import { getUser } from "~/lib/session.server";
import { useFormatDay, useT } from "~/i18n/use-t";
import { initialsOf } from "~/lib/initials";
import { pageTitle, pageTitleRaw } from "~/i18n/meta";
import { StateBadge } from "~/components/state-badge";
import { PageShell } from "~/components/page";
import { Button, ButtonLink } from "~/components/button";
import { CartBar } from "~/components/cart-bar";
import { useCart } from "~/lib/use-cart";

/** Fin dove si mostrano le prenotazioni già prese. Oltre, l'elenco diventa
 * lungo e smette di rispondere alla domanda vera: «lo trovo libero adesso?» */
const HORIZON_DAYS = 120;

export function meta({ matches, loaderData }: Route.MetaArgs) {
  // Il nome di un oggetto non si traduce: `pageTitleRaw` gli attacca solo il
  // nome dell'applicazione. `loaderData` è `undefined` quando il loader ha
  // lanciato un 404, e lì il titolo resta quello generico.
  return [
    {
      title: loaderData
        ? pageTitleRaw(matches, loaderData.asset.name)
        : pageTitle(matches, "catalogue.heading"),
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const today = todayUtc();
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86_400_000);

  const asset = await db.asset.findFirst({
    // `findFirst` e non `findUnique`: serve una condizione in più dell'id.
    // Un oggetto archiviato non è nel catalogo, quindi la sua scheda non
    // esiste — 404, non una pagina che invita a prenotare qualcosa che non
    // c'è più.
    where: { id: params.id, archivedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      isBookable: true,
      category: { select: { name: true, slug: true } },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, thumbUrl: true },
      },
    },
  });

  if (!asset) throw new Response("Not found", { status: 404 });

  const [current, occupancy, user] = await Promise.all([
    getCurrentAvailability(),
    // `withHolders` spento: il pubblico vede *quando* è occupato, mai da chi.
    getOccupancy(today, horizon, { includePending: false }),
    getUser(request),
  ]);

  return {
    asset,
    availability: current.get(asset.id) ?? FREE,
    bookings: occupancy
      .filter((entry) => entry.assetId === asset.id)
      .map((entry) => ({
        id: entry.id,
        startDate: formatDay(entry.startDate),
        endDate: formatDay(entry.endDate),
      })),
    today: formatDay(today),
    user: user ? { name: user.name } : null,
  };
}

export default function Item({ loaderData }: Route.ComponentProps) {
  const { asset, availability, bookings, today, user } = loaderData;
  const t = useT();
  const formatDayLabel = useFormatDay();
  const cart = useCart();
  const inCart = cart.has(asset.id);

  return (
    <>
      <main>
        <PageShell width="narrow" className="pb-32 pt-8">
          <ButtonLink
            to={asset.category ? `/?cat=${asset.category.slug}` : "/"}
            variant="plain"
            size="sm"
            className="px-0"
          >
            ← {t("item.backToCatalogue")}
          </ButtonLink>

          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
            <Gallery name={asset.name} photos={asset.photos} />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {asset.category && (
                <span className="eyebrow">
                  {asset.category.name}
                </span>
              )}

              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                {asset.name}
              </h1>

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

              {asset.description && (
                <p className="max-w-prose whitespace-pre-line text-sm text-muted">
                  {asset.description}
                </p>
              )}

              {inCart ? (
                <Button
                  variant="danger"
                  className="mt-2 self-start"
                  onClick={() => cart.remove(asset.id)}
                >
                  {t("cart.remove")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-2 self-start"
                  disabled={!asset.isBookable}
                  onClick={() => cart.add({ assetId: asset.id, name: asset.name })}
                >
                  {t("cart.add")}
                </Button>
              )}
            </div>
          </div>

          <section className="mt-10">
            <h2 className="eyebrow">
              {t("item.taken")}
            </h2>

            {bookings.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("item.takenEmpty")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {bookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="rounded border border-rule bg-card px-3 py-2 font-mono text-xs tabular-nums"
                  >
                    {formatDayLabel(booking.startDate)} —{" "}
                    {formatDayLabel(booking.endDate)}
                  </li>
                ))}
              </ul>
            )}

            <ButtonLink
              to="/calendar"
              variant="plain"
              size="sm"
              className="mt-3 px-0"
            >
              {t("item.seeCalendar")} →
            </ButtonLink>
          </section>
        </PageShell>
      </main>

      <CartBar cart={cart} today={today} user={user} />
    </>
  );
}

/**
 * Le foto. La prima grande, le altre come miniature che la sostituiscono:
 * niente libreria e niente carosello, che su un telefono è quasi sempre un
 * modo per nascondere la seconda foto.
 */
function Gallery({
  name,
  photos,
}: {
  name: string;
  photos: Array<{ id: string; url: string; thumbUrl: string }>;
}) {
  const [active, setActive] = useState(0);
  const t = useT();

  if (photos.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="flex aspect-4/3 w-full shrink-0 items-center justify-center rounded border border-rule bg-sunk font-serif text-5xl text-faint sm:w-64"
      >
        {initialsOf(name)}
      </div>
    );
  }

  return (
    <div className="w-full shrink-0 sm:w-64">
      <img
        src={photos[active]!.url}
        alt={t("item.photoAlt", { name })}
        className="aspect-4/3 w-full rounded border border-rule bg-sunk object-cover"
      />

      {photos.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActive(index)}
              aria-current={index === active}
              className={`h-14 w-14 overflow-hidden rounded border ${
                index === active ? "border-accent" : "border-rule"
              }`}
            >
              <img
                src={photo.thumbUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
