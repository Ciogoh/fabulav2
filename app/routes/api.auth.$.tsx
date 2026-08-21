/**
 * Tutte le richieste di accesso passano da qui.
 *
 * Better Auth espone un solo gestore per `/api/auth/*`: registrazione, login,
 * codici OTP, ritorno da Google, disconnessione. Non c'è niente da scrivere
 * rotta per rotta.
 */

import type { Route } from "./+types/api.auth.$";
import { auth } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  return auth.handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  return auth.handler(request);
}
