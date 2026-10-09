/** La coda di pubblicazione non coincide con la coda di approvazione dei prestiti. */
import type { Route } from "./+types/admin.proposals";
import { requireAdmin } from "~/lib/session.server";
import { proposalList } from "~/lib/proposal-list.server";
import { ProposalList } from "~/components/proposal-list";
import { pageTitle } from "~/i18n/meta";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.proposals") }];
}
export async function loader({ request }: Route.LoaderArgs) {
  return proposalList(await requireAdmin(request), new URL(request.url), true);
}
export default function Proposals({ loaderData }: Route.ComponentProps) {
  return <ProposalList data={loaderData} />;
}
