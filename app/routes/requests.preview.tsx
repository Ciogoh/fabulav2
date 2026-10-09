/** Anteprima autenticata: il server raggruppa, senza anticipare identità personali. */
import { data } from "react-router";
import type { Route } from "./+types/requests.preview";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { PUBLISHED_ASSET } from "~/lib/asset-publication.server";
import { groupByLender } from "~/lib/marketplace";
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const ids = [
    ...new Set(
      (new URL(request.url).searchParams.get("ids") ?? "")
        .split(",")
        .filter(Boolean),
    ),
  ].slice(0, 100);
  const assets = await db.asset.findMany({
    where: { id: { in: ids }, ...PUBLISHED_ASSET },
    orderBy: { name: "asc" },
    select: { id: true, name: true, ownerId: true, isBookable: true },
  });
  return data(
    {
      groups: groupByLender(assets).map((g, index) => ({
        institutional: g.lenderId === null,
        number: index + 1,
        items: g.assets.map((a) => ({ id: a.id, name: a.name })),
      })),
      selfLoan: assets.some((a) => a.ownerId === user.id),
      unavailable:
        assets.length !== ids.length || assets.some((a) => !a.isBookable),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
