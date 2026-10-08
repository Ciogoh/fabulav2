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
import { submissionContent } from "~/lib/marketplace";
import type { loader as previewLoader } from "~/routes/requests.preview";
import type { loader as availabilityLoader } from "~/routes/availability";
import type { action as createRequestAction } from "~/routes/requests";
import { useT } from "~/i18n/use-t";
import { Button, ButtonLink } from "~/components/button";
import { Dialog } from "~/components/dialog";
import {
  DateRangeFields,
  daysBetweenInclusive,
} from "~/components/date-range-fields";
import { MAX_ORDINARY_SPAN_DAYS } from "~/lib/availability.shared";
import type { CartEntry, useCart } from "~/lib/use-cart";

export function CartBar({
  cart,
  today,
  user,
}: {
  cart: ReturnType<typeof useCart>;
  today: string;
  user: { id: string; name: string } | null;
}) {
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!cart.ready || cart.entries.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-30 border-t border-rule bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
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
            <ButtonLink to="/signin?next=/catalogue" variant="primary">
              {t("cart.submit")} ({cart.entries.length})
            </ButtonLink>
          )}
        </div>
      </div>

      {dialogOpen && (
        <RequestDialog
          userId={user!.id}
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

/**
 * Le regole di un modale — fuoco intrappolato e restituito, Escape, click sul
 * velo, pagina dietro che non scorre — vivono in `components/dialog.tsx`.
 * Stavano qui dentro finché il modale era uno solo; adesso ce n'è anche uno
 * di conferma, e valgono per tutti e due.
 */

function RequestDialog({
  userId,
  entries,
  today,
  onRemove,
  onClose,
  onSuccess,
}: {
  userId: string;
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
  const preview = useFetcher<typeof previewLoader>();
  const [submission, setSubmission] = useState<{
    content: string;
    key: string;
  } | null>(null);
  const attemptedKey = useRef<string | null>(null);
  const retryStore = `fabula:request-submission:${userId}`;
  const headingId = useId();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [longer, setLonger] = useState(false);
  const [purpose, setPurpose] = useState("");

  const busy = fetcher.state !== "idle";
  const ids = entries.map((entry) => entry.assetId).join(",");
  const content = submissionContent(
    entries.map((e) => ({ assetId: e.assetId, fromKitId: e.fromKitId })),
    from,
    to,
    purpose.slice(0, 2000),
  );
  const submissionKey = submission?.content === content ? submission.key : "";
  function attempts(): Array<{ content: string; key: string }> {
    try {
      const raw: unknown = JSON.parse(
        sessionStorage.getItem(retryStore) ?? "[]",
      );
      return Array.isArray(raw)
        ? raw
            .filter(
              (row) =>
                row &&
                typeof row.content === "string" &&
                typeof row.key === "string",
            )
            .slice(-20)
        : [];
    } catch {
      return [];
    }
  }
  useEffect(() => {
    const key =
      attempts().find((row) => row.content === content)?.key ??
      crypto.randomUUID();
    setSubmission({ content, key });
  }, [content, retryStore]);
  function rememberAttempt() {
    if (!submissionKey) return;
    attemptedKey.current = submissionKey;
    // Conservare solo invii tentati evita che digitare il motivo cancelli
    // la chiave di una risposta persa. Riaprire il foglio consente lo stesso retry.
    try {
      sessionStorage.setItem(
        retryStore,
        JSON.stringify(
          [
            ...attempts().filter((row) => row.content !== content),
            { content, key: submissionKey },
          ].slice(-20),
        ),
      );
    } catch {
      /* Memoria del browser non disponibile; la chiave resta nella pagina. */
    }
  }
  useEffect(() => {
    preview.load(`/requests/preview?ids=${encodeURIComponent(ids)}`);
  }, [ids]);

  /* Disponibilità dal vivo: a ogni cambio di date o di carrello. Il ritardo
     serve a non partire a ogni tasto premuto dentro al campo data. */
  useEffect(() => {
    if (!from || !to || to < from) return;
    const timer = setTimeout(() => {
      availability.load(
        `/availability?from=${from}&to=${to}&ids=${encodeURIComponent(ids)}`,
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
      try {
        sessionStorage.setItem(
          retryStore,
          JSON.stringify(
            attempts().filter((row) => row.key !== attemptedKey.current),
          ),
        );
      } catch {
        /* Nessuna cache da ripulire. */
      }
      onSuccess();
      navigate(
        fetcher.data.requestIds.length === 1
          ? `/requests/${fetcher.data.requestIds[0]}`
          : `/requests/batches/${fetcher.data.batchId}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  const result = fetcher.data && !fetcher.data.ok ? fetcher.data : null;
  const span = daysBetweenInclusive(from, to);
  const tooLong = !longer && span > MAX_ORDINARY_SPAN_DAYS;
  const itemRow = (entry: CartEntry) => (
    <li key={entry.assetId} className="flex items-center justify-between gap-3">
      <span
        className={`min-w-0 break-words ${taken.has(entry.assetId) ? "text-out" : "text-muted"}`}
      >
        {entry.name}
        {taken.has(entry.assetId) && (
          <span className="ml-2 text-xs">{t("request.taken")}</span>
        )}
      </span>
      <Button
        variant="plain"
        onClick={() => onRemove(entry.assetId)}
        aria-label={`${t("cart.remove")} ${entry.name}`}
        className="shrink-0"
      >
        {t("cart.remove")}
      </Button>
    </li>
  );
  const grouped = new Set(
    preview.data?.groups.flatMap((g) => g.items.map((i) => i.id)) ?? [],
  );
  const ungrouped = entries.filter((entry) => !grouped.has(entry.assetId));

  return (
    <Dialog onClose={onClose} labelledBy={headingId} panelClassName="max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <h2 id={headingId} className="font-serif text-xl font-semibold">
          {t("request.heading")}
        </h2>
        <Button
          variant="plain"
          onClick={onClose}
          aria-label={t("request.close")}
          className="-mr-2 -mt-1 px-2 no-underline"
        >
          ✕
        </Button>
      </div>

      <div className="mt-4 max-h-80 shrink-0 overflow-y-auto text-sm">
        {preview.data && (
          <section>
            <ul className="flex flex-col gap-3">
              {preview.data.groups.map((g) => (
                <li key={g.number} className="rounded-sm bg-sunk px-3 py-2">
                  <h3 className="font-medium">
                    {g.institutional
                      ? "Material Matters"
                      : t("p2p.group", { number: g.number })}
                  </h3>
                  <ul className="mt-1">
                    {g.items
                      .map((i) => entries.find((e) => e.assetId === i.id))
                      .filter((e): e is CartEntry => Boolean(e))
                      .map(itemRow)}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
        {ungrouped.length > 0 && (
          <ul className="mt-2">{ungrouped.map(itemRow)}</ul>
        )}
      </div>
      {preview.data && (
        <p className="mt-3 text-sm text-muted">
          {t(
            preview.data.groups.length === 1
              ? "p2p.singleNote"
              : "p2p.splitNote",
            { count: preview.data.groups.length },
          )}
        </p>
      )}
      {preview.data?.selfLoan && (
        <p role="alert" className="mt-3 text-sm text-out">
          {t("p2p.errorSelfLoan")}
        </p>
      )}
      {preview.data?.unavailable && (
        <p role="alert" className="mt-3 text-sm text-out">
          {t("request.errorUnavailable")}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">{t("p2p.notReserved")}</p>
      <fetcher.Form
        method="post"
        action="/requests"
        onSubmit={rememberAttempt}
        className="mt-5 flex flex-col gap-4"
      >
        <input type="hidden" name="submissionKey" value={submissionKey} />
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(
            entries.map((entry) => ({
              assetId: entry.assetId,
              fromKitId: entry.fromKitId,
            })),
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
          className={`text-xs ${
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
            className="self-start"
            onClick={() =>
              takenEntries.forEach((entry) => onRemove(entry.assetId))
            }
          >
            {t("request.removeTaken")}
          </Button>
        )}

        {result && (
          <p
            role="alert"
            className="rounded-sm bg-out-bg px-3 py-2 text-sm text-out"
          >
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
            busy={busy}
            disabled={
              tooLong ||
              takenEntries.length > 0 ||
              !submissionKey ||
              !preview.data ||
              preview.state !== "idle" ||
              preview.data.selfLoan ||
              preview.data.unavailable
            }
          >
            {preview.data && preview.data.groups.length > 1
              ? t("p2p.sendRequests", { count: preview.data.groups.length })
              : t("request.submit")}
          </Button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
