/**
 * Un oggetto nuovo — con le foto attaccate nello stesso invio, se ce ne
 * sono: non serve creare e poi tornare indietro per aggiungerle.
 */

import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/admin.assets.new";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { saveAssetPhoto } from "~/lib/uploads.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { AssetFields } from "~/components/asset-fields";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return { categories };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "assets.errorName" as TranslationKey };
  }

  const description = String(form.get("description") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const adminNotes = String(form.get("adminNotes") ?? "").trim();
  const categoryId = String(form.get("categoryId") ?? "") || null;
  const isBookable = form.get("unavailable") !== "on";

  const asset = await db.asset.create({
    data: {
      name: name.slice(0, 120),
      description: description || null,
      location: location || null,
      adminNotes: adminNotes || null,
      categoryId,
      isBookable,
    },
    select: { id: true },
  });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const result = await saveAssetPhoto(asset.id, file);
    if (result.ok) {
      await db.assetPhoto.create({
        data: { assetId: asset.id, url: result.url, thumbUrl: result.thumbUrl },
      });
    }
    // Una foto rifiutata non deve bloccare la creazione dell'oggetto — chi
    // carica corregge dopo, dalla scheda di modifica.
  }

  return redirect(`/admin/assets/${asset.id}`);
}

export default function NewAsset({ loaderData, actionData }: Route.ComponentProps) {
  const { categories } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <main className="mx-auto w-full max-w-lg px-6 pb-24 pt-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {t("assets.newHeading")}
      </h1>

      <Form method="post" encType="multipart/form-data" className="mt-8 flex flex-col gap-4">
        <AssetFields categories={categories} />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="photos"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
          >
            {t("assets.photos")}
          </label>
          <input
            id="photos"
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:bg-sunk disabled:text-faint"
        >
          {t("assets.save")}
        </button>
      </Form>

      {actionData?.error && (
        <p role="alert" className="mt-6 rounded bg-out-bg px-3 py-2 text-sm text-out">
          {t(actionData.error)}
        </p>
      )}
    </main>
  );
}
