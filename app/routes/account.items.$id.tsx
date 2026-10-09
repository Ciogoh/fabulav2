/** Gestione privata dell'oggetto proposto dal socio. */
import { redirect } from "react-router";
import type { Route } from "./+types/account.items.$id";
import { requireUser } from "~/lib/session.server";
import {
  proposalPage,
  proposalAction,
  ProposalError,
  proposalErrorValues,
} from "~/lib/asset-proposals.server";
import { ProposalDetail } from "~/components/proposal-detail";
import { pageTitle } from "~/i18n/meta";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.myItems") }];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return proposalPage(user, params.id);
}
export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  try {
    const result = await proposalAction(user, params.id, form);
    if ("deleted" in result && result.deleted)
      return redirect("/account/items");
    if ("photoError" in result)
      return redirect(
        `/account/items/${params.id}?notice=${result.photoError ? "photo" : result.submitted ? "submitted" : "draft"}`,
      );
    return result;
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
export default function ItemProposal({
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
