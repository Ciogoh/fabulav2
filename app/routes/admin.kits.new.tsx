/**
 * Un kit nuovo: nome, descrizione e i pezzi, tutto in un invio solo.
 */

import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/admin.kits.new";
import { PageShell, PageTitle } from "~/components/page";
import { buttonClass, ButtonLink } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { assetIdsFrom, assetOptions, replaceKitAssets } from "~/lib/kits.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { KitFields } from "~/components/kit-fields";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "kits.newHeading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return { assets: await assetOptions() };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "kits.errorName" as TranslationKey };
  }

  const assetIds = assetIdsFrom(form);
  if (assetIds.length === 0) {
    // Un kit vuoto non è un kit a metà: è una scheda che il pubblico vede nel
    // catalogo e che, premuta, non aggiunge niente al carrello.
    return { error: "kits.errorNoAssets" as TranslationKey };
  }

  const description = String(form.get("description") ?? "").trim();

  const kit = await db.kit.create({
    data: { name: name.slice(0, 120), description: description || null },
    select: { id: true },
  });

  await replaceKitAssets(kit.id, assetIds);

  return redirect("/admin/kits");
}

export default function NewKit({ loaderData, actionData }: Route.ComponentProps) {
  const { assets } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("kits.newHeading")} />

        <Form method="post" className="mt-8 flex flex-col gap-4">
          <KitFields assets={assets} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className={buttonClass("primary", "md", "self-start")}
            >
              {t("kits.save")}
            </button>
            <ButtonLink to="/admin/kits" variant="plain">
              {t("kits.cancel")}
            </ButtonLink>
          </div>
        </Form>

        {actionData?.error && (
          <p role="alert" className="mt-6 rounded bg-out-bg px-3 py-2 text-sm text-out">
            {t(actionData.error)}
          </p>
        )}
      </PageShell>
    </main>
  );
}
