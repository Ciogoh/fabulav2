/** Un solo controllo di partecipazione per dettaglio e canali privati. */
import { db } from "~/lib/db.server";
import { requestCapabilities } from "~/lib/marketplace";
import type { CurrentUser } from "~/lib/session.server";

export async function requireRequestAccess(user: CurrentUser, id: string) {
  const target = await db.request.findUnique({
    where: { id },
    select: { userId: true, lenderId: true },
  });
  if (!target || !requestCapabilities(user, target).read)
    throw new Response("Not found", { status: 404 });
  return target;
}
