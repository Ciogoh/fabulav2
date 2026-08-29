/**
 * Cambio tema.
 *
 * Gemella di `routes/language.tsx`, e per le stesse ragioni: è una `action` e
 * non un link con `?theme=`, così l'indirizzo resta pulito e la scelta non
 * finisce dentro ai collegamenti che si condividono.
 *
 * **Senza JavaScript funziona lo stesso**: è un modulo che manda qui e torna
 * indietro con `redirect`. Il `fetcher` del profilo lo manda senza cambiare
 * pagina quando il JavaScript c'è.
 *
 * Niente scrittura sul profilo, a differenza della lingua: vedi `lib/theme.ts`
 * per il perché il tema è del dispositivo e non della persona.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/theme";
import { isTheme } from "~/lib/theme";
import { themeCookie } from "~/lib/theme.server";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const theme = form.get("theme");
  const redirectTo = form.get("redirectTo");

  if (!isTheme(theme)) return redirect("/");

  // Solo percorsi interni: un `redirectTo` preso dalla form senza controlli
  // è un open redirect, e serve a portare la gente su siti altrui.
  const target =
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
      ? redirectTo
      : "/account";

  return redirect(target, { headers: { "Set-Cookie": themeCookie(theme) } });
}
