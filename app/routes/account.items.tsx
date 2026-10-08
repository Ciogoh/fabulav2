/** Il socio ritrova bozze, proposte e oggetti pubblicati in un unico elenco privato. */
import type { Route } from "./+types/account.items";
import { requireUser } from "~/lib/session.server";
import { proposalList } from "~/lib/proposal-list.server";
import { ProposalList } from "~/components/proposal-list";
import { pageTitle } from "~/i18n/meta";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.myItems") }];
}
export async function loader({ request }: Route.LoaderArgs) {
  return proposalList(await requireUser(request), new URL(request.url));
}
export default function MyItems({ loaderData }: Route.ComponentProps) {
  return <ProposalList data={loaderData} />;
}
