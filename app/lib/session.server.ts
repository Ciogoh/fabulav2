/**
 * Chi sta guardando la pagina.
 *
 * Tre livelli, da usare in cima ai loader e alle action:
 *
 *   getUser      — può essere nessuno (catalogo pubblico)
 *   requireUser  — serve un account (fare una richiesta)
 *   requireAdmin — serve un amministratore (creare oggetti, approvare)
 *
 * **La regola:** ogni action che scrive qualcosa deve cominciare con
 * `requireUser` o `requireAdmin`. Nascondere un pulsante nell'interfaccia non
 * protegge niente — l'indirizzo resta raggiungibile da chiunque.
 */

import { redirect } from "react-router";
import { auth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import type { Language, Role } from "~/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  email: string;
  /** Il nome in una stringa sola. Per mostrarlo non si usa quasi mai questo:
   * si passa l'oggetto intero a `displayNameOf` o a `<PersonName>`. */
  name: string;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  image: string | null;
  role: Role;
  language: Language;
  isMember: boolean;
};

/**
 * L'utente collegato, o `null`.
 *
 * I dati vengono riletti dal database e non dalla sessione: se un admin cambia
 * il ruolo di qualcuno, la modifica ha effetto alla richiesta successiva
 * invece di aspettare la scadenza della sessione.
 */
export async function getUser(request: Request): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      alias: true,
      image: true,
      role: true,
      language: true,
      isMember: true,
    },
  });

  return user;
}

/** Come `getUser`, ma rimanda all'accesso se non c'è nessuno. */
export async function requireUser(request: Request): Promise<CurrentUser> {
  const user = await getUser(request);
  if (user) return user;

  // Ci si ritrova dove si era, dopo essere entrati.
  const url = new URL(request.url);
  const next = encodeURIComponent(url.pathname + url.search);
  throw redirect(`/signin?next=${next}`);
}

/**
 * Solo amministratori.
 *
 * Risponde 404 e non 403 di proposito: a chi non è admin il pannello non deve
 * nemmeno risultare esistente.
 */
export async function requireAdmin(request: Request): Promise<CurrentUser> {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") {
    throw new Response("Not found", { status: 404 });
  }
  return user;
}
