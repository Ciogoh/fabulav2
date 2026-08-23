/**
 * Cambio lingua.
 *
 * Salva la scelta in un cookie e riporta la persona dove si trovava. È una
 * `action` e non un link con `?lang=`, così l'indirizzo resta pulito e la
 * lingua non finisce dentro ai collegamenti che si condividono.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/language";
import { isLang } from "~/i18n/dictionaries";
import { langCookie } from "~/i18n/lang.server";
import { db } from "~/lib/db.server";
import { getUser } from "~/lib/session.server";
import type { Language } from "~/generated/prisma/enums";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const lang = form.get("lang");
  const redirectTo = form.get("redirectTo");

  if (!isLang(lang)) {
    return redirect("/");
  }

  // La scelta va anche sul profilo, non solo nel cookie. Altrimenti il profilo
  // resta fermo sul suo valore iniziale e — avendo la precedenza — riporta
  // tutto in inglese al primo accesso da un altro computer.
  const user = await getUser(request);
  // Solo se cambia davvero: premere la lingua già attiva è la cosa più facile
  // del mondo con tre pulsanti sempre in vista, e non deve costare una scrittura.
  if (user && user.language !== lang.toUpperCase()) {
    await db.user.update({
      where: { id: user.id },
      data: { language: lang.toUpperCase() as Language },
    });
  }

  // Solo percorsi interni: un `redirectTo` preso dalla form senza controlli
  // è un open redirect, e serve a portare la gente su siti altrui.
  const target =
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  return redirect(target, { headers: { "Set-Cookie": langCookie(lang) } });
}
