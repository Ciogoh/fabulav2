/**
 * Gli oggetti in ritardo, che adesso sono una sezione del Centro.
 *
 * Come per la coda di approvazione, il file resta solo per non rompere i
 * segnalibri: l'elenco vero sta in `routes/admin.tsx`.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/admin.overdue";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  throw redirect("/admin?vista=ritardo");
}
