/** Revisione amministrativa della proposta: chat e decisione distinte dal prestito. */
import type { Route } from "./+types/admin.proposals.$id";
import { requireAdmin } from "~/lib/session.server";
import {
  proposalPage,
  proposalAction,
  ProposalError,
  proposalErrorValues,
} from "~/lib/asset-proposals.server";
import { ProposalDetail } from "~/components/proposal-detail";
import { pageTitle } from "~/i18n/meta";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.review") }];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  return proposalPage(await requireAdmin(request), params.id, true);
}
export async function action({ request, params }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  try {
    return await proposalAction(admin, params.id, form, true);
  } catch (error) {
    if (error instanceof ProposalError)
      return {
        ok: false as const,
        error: error.key,
        values: proposalErrorValues(form),
      };
    throw error;
  }
}
export default function ReviewProposal({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <ProposalDetail
      data={loaderData}
      values={
        actionData && "values" in actionData ? actionData.values : undefined
      }
      error={actionData && "error" in actionData ? actionData.error : undefined}
    />
  );
}
