/**
 * Le etichette dei quattro stati di una richiesta, in un posto solo.
 *
 * Erano scritte due volte identiche — in `requests.tsx` e in
 * `request-detail.tsx`, più una terza copia `as const` in
 * `admin.requests.tsx` — e la scheda di un oggetto ne avrebbe voluta una
 * quarta. È lo stesso difetto che ha fatto nascere la regola 7 (un pulsante
 * solo, un guscio solo): una mappa copiata quattro volte è una mappa che
 * prima o poi diverge, e nessuno se ne accorge finché uno stato non compare
 * tradotto in un posto e grezzo in un altro.
 *
 * Sta in `lib/` e non in `i18n/` perché è una mappa di **dominio** — dallo
 * stato di una richiesta alla sua etichetta — e non un pezzo del meccanismo
 * di traduzione. Niente `.server`: serve anche al browser.
 */

import type { TranslationKey } from "~/i18n/dictionaries";
import type { RequestStatus } from "~/generated/prisma/enums";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, TranslationKey> = {
  PENDING: "requests.status.pending",
  APPROVED: "requests.status.approved",
  REJECTED: "requests.status.rejected",
  CANCELLED: "requests.status.cancelled",
};
