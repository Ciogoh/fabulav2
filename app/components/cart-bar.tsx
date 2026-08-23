/**
 * Il carrello appiccicato in fondo, e il foglio con cui diventa una richiesta.
 *
 * Stava dentro a `catalogue.tsx`; è uscito di lì quando anche la scheda del
 * singolo oggetto ha avuto il pulsante «Aggiungi» — due posti da cui si
 * riempie lo stesso carrello devono mostrare la stessa barra, o l'oggetto
 * aggiunto dalla scheda sembra sparito.
 *
 * Il difetto che questo file esiste per correggere: **le date si sceglievano
 * alla cieca.** Il foglio non diceva niente sulla disponibilità e il conflitto
 * arrivava come errore dopo l'invio. Ora, a ogni cambio di data, interroga
 * `/availability` e segna i pezzi occupati sul posto — con il pulsante per
 * toglierli tutti in un colpo.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import type { loader as availabilityLoader } from "~/routes/availability";
import type { action as createRequestAction } from "~/routes/requests";
import { useT } from "~/i18n/use-t";
import { Button, ButtonLink } from "~/components/button";
import { DateRangeFields, daysBetweenInclusive } from "~/components/date-range-fields";
import { MAX_ORDINARY_SPAN_DAYS } from "~/lib/availability.shared";
import type { CartEntry, useCart } from "~/lib/use-cart";

export function CartBar({
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
    <div className="sticky bottom-0 z-30 border-t border-rule bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
            {t("cart.heading")}
            {/* Il conteggio è già dentro al pulsante: sullo stretto ripeterlo
                mandava l'intestazione della barra a capo. */}
            <span className="hidden sm:inline">
              {" · "}
              {t("cart.itemCount", { count: cart.entries.length })}
            </span>
          </p>
          <p className="truncate text-sm">
            {cart.entries.map((entry) => entry.name).join(" · ")}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Button variant="plain" size="sm" onClick={cart.clear}>
            {t("cart.clear")}
          </Button>

          {user ? (
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              {t("cart.submit")} ({cart.entries.length})
            </Button>
          ) : (
            <ButtonLink to="/signin?next=/" variant="primary">
              {t("cart.submit")} ({cart.entries.length})
            </ButtonLink>
          )}
        </div>
      </div>

      {dialogOpen && (
        <RequestDialog
          entries={cart.entries}
          today={today}
          onRemove={cart.remove}
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

/* --------------------------------------------------------- il foglio */

function RequestDialog({
  entries,
  today,
  onRemove,
  onClose,
  onSuccess,
}: {
  entries: CartEntry[];
  today: string;
  onRemove: (assetId: string) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof createRequestAction>();
  const availability = useFetcher<typeof availabilityLoader>();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [longer, setLonger] = useState(false);
  const [purpose, setPurpose] = useState("");

  const busy = fetcher.state !== "idle";
  const ids = entries.map((entry) => entry.assetId).join(",");

  /* Disponibilità dal vivo: a ogni cambio di date o di carrello. Il ritardo
     serve a non partire a ogni tasto premuto dentro al campo data. */
  useEffect(() => {
    if (!from || !to || to < from) return;
    const timer = setTimeout(() => {
      availability.load(
        `/availability?from=${from}&to=${to}&ids=${encodeURIComponent(ids)}`
      );
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, ids]);

  const taken = new Set(availability.data?.busy ?? []);
  const checking = availability.state !== "idle";
  const takenEntries = entries.filter((entry) => taken.has(entry.assetId));

  /* A richiesta creata, si va sulla sua pagina. */
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      onSuccess();
      navigate(`/requests/${fetcher.data.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  /**
   * Le regole di un dialogo modale, che prima mancavano tutte: il focus entra
   * dentro, ci resta finché il foglio è aperto, e torna da dove era partito
   * alla chiusura. Senza, col solo tasto Tab si finiva a navigare il catalogo
   * dietro al foglio senza vedere dove si era.
   */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.dataset.dialogOpen = "true";

    // Sul primo campo, non sulla ✕: il foglio si apre per scegliere le date,
    // e chi arriva da tastiera deve trovarsi già dove si scrive.
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("input, select, textarea") ??
      panel?.querySelector<HTMLElement>("button, a[href], [tabindex]");
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      delete document.body.dataset.dialogOpen;
      previous?.focus();
    };
  }, [onClose]);

  const result = fetcher.data && !fetcher.data.ok ? fetcher.data : null;
  const span = daysBetweenInclusive(from, to);
  const tooLong = !longer && span > MAX_ORDINARY_SPAN_DAYS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      // Velo nero, non `bg-ink/50`: nel tema scuro `--ink` è chiaro, quindi il
      // velo *schiariva* la pagina dietro invece di spegnerla.
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-t border border-rule bg-card p-5 sm:rounded"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={headingId} className="font-serif text-xl font-semibold">
            {t("request.heading")}
          </h2>
          <Button
            variant="plain"
            size="sm"
            onClick={onClose}
            aria-label={t("request.close")}
            className="-mr-2 -mt-1 px-2 no-underline"
          >
            ✕
          </Button>
        </div>

        {/* L'elenco non è più una finestrella alta 96px che scorreva senza
            dirlo: si vede intero fino a sei pezzi, e ogni riga porta il suo
            stato nelle date scelte. */}
        <ul className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
          {entries.map((entry) => {
            const conflict = taken.has(entry.assetId);
            return (
              <li
                key={entry.assetId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
              >
                <span className={conflict ? "text-out" : "text-muted"}>
                  {entry.name}
                </span>
                {conflict && (
                  <span className="rounded-full bg-out-bg px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-out">
                    {t("request.taken")}
                  </span>
                )}
              </li>
            );
          })}
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

          <DateRangeFields
            today={today}
            from={from}
            to={to}
            longer={longer}
            purpose={purpose}
            onFromChange={setFrom}
            onToChange={setTo}
            onLongerChange={setLonger}
            onPurposeChange={setPurpose}
          />

          {/* L'esito del controllo, nel punto in cui si scelgono le date. */}
          <p
            aria-live="polite"
            className={`text-[0.8rem] ${
              takenEntries.length > 0 ? "text-out" : "text-muted"
            }`}
          >
            {checking
              ? t("request.checking")
              : takenEntries.length === 1
                ? t("request.takenOne")
                : takenEntries.length > 1
                  ? t("request.takenCount", { count: takenEntries.length })
                  : t("request.allFree")}
          </p>

          {takenEntries.length > 0 && (
            <Button
              variant="quiet"
              size="sm"
              className="self-start"
              onClick={() =>
                takenEntries.forEach((entry) => onRemove(entry.assetId))
              }
            >
              {t("request.removeTaken")}
            </Button>
          )}

          {result && (
            <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
              {t(result.error)}
              {result.conflicts && result.conflicts.length > 0 && (
                <> — {result.conflicts.join(", ")}</>
              )}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="plain" onClick={onClose}>
              {t("request.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || tooLong || takenEntries.length > 0}
            >
              {t("request.submit")}
            </Button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}
