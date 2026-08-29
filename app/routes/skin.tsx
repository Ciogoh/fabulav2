/**
 * Cambio pelle.
 *
 * Gemella di `routes/theme.tsx`, per le stesse ragioni: `action` e non
 * `?skin=`, funziona senza JavaScript, niente scrittura sul profilo.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/skin";
import { isSkin } from "~/lib/skin";
import { skinCookie } from "~/lib/skin.server";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const skin = form.get("skin");
  const redirectTo = form.get("redirectTo");

  if (!isSkin(skin)) return redirect("/");

  // Solo percorsi interni: vedi la stessa guardia in `routes/theme.tsx`.
  const target =
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
      ? redirectTo
      : "/account";

  return redirect(target, { headers: { "Set-Cookie": skinCookie(skin) } });
}
