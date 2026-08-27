/**
 * La coda di approvazione, che adesso è una sezione del Centro.
 *
 * Questo file resta per una ragione sola: **un segnalibro non deve smettere
 * di funzionare per una riorganizzazione nostra.** L'elenco vive in
 * `routes/admin.tsx`, insieme a ritardi, messaggi non letti e al lavoro di
 * oggi — che è il punto: prima erano tre posti da guardare e nessuno che li
 * riassumesse.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/admin.requests";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  // Prima di rimandare: chi non è admin non deve nemmeno scoprire che questo
  // indirizzo porta da qualche parte (`requireAdmin` risponde 404, non 403).
  await requireAdmin(request);
  throw redirect("/admin?vista=approvare");
}
