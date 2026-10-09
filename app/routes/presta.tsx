/** La proposta nasce come bozza recuperabile; l'invio non equivale alla pubblicazione. */
import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/presta";
import { PageShell, PageTitle } from "~/components/page";
import { Button, ButtonLink } from "~/components/button";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { saveProposal, ProposalError } from "~/lib/asset-proposals.server";
import { useT } from "~/i18n/use-t";
import { pageTitle } from "~/i18n/meta";
import { AssetFields } from "~/components/asset-fields";
import { PhotoFields } from "~/components/photo-picker";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.heading") }];
}
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return {
    categories: await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  };
}
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  try {
    const saved = await saveProposal(user, form);
    return redirect(
      `/account/items/${saved.id}?notice=${saved.photoError ? "photo" : saved.submitted ? "submitted" : "draft"}`,
    );
  } catch (error) {
    if (!(error instanceof ProposalError)) throw error;
    return {
      error: error.key,
      values: {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        categoryId: String(form.get("categoryId") ?? ""),
      },
    };
  }
}
export default function Presta({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <ButtonLink
          to="/account/items"
          variant="plain"
          size="sm"
          className="mb-4 px-0"
        >
          ← {t("p2p.myItems")}
        </ButtonLink>

        <PageTitle title={t("p2p.heading")} intro={t("p2p.intro")} />

        {actionData?.error && (
          <p
            role="alert"
            className="mt-6 rounded-sm bg-out-bg px-3 py-2 text-sm text-out"
          >
            {t(actionData.error)}
          </p>
        )}

        <Form
          method="post"
          encType="multipart/form-data"
          className="mt-8 flex flex-col gap-4"
        >
          <AssetFields
            categories={loaderData.categories}
            defaults={actionData?.values}
            isAdmin={false}
          />
          <PhotoFields />
          <div className="flex flex-wrap gap-3">
            <Button
              name="intent"
              value="saveDraft"
              type="submit"
              variant="secondary"
              busy={busy}
            >
              {t("p2p.saveDraft")}
            </Button>
            <Button
              name="intent"
              value="submit"
              type="submit"
              variant="primary"
              busy={busy}
            >
              {t("p2p.submit")}
            </Button>
          </div>
        </Form>
      </PageShell>
    </main>
  );
}
