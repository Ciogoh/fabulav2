/**
 * Un oggetto nuovo — con le foto attaccate nello stesso invio, se ce ne
 * sono: non serve creare e poi tornare indietro per aggiungerle.
 */

import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/admin.assets.new";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { saveAssetPhoto } from "~/lib/uploads.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { categoryFromForm } from "~/lib/categories.server";
import { AssetFields } from "~/components/asset-fields";
import { PhotoFields } from "~/components/photo-picker";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "assets.newHeading") }];
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
  const isBookable = form.get("unavailable") !== "on";

  // Prima di creare l'oggetto: se la categoria nuova non ha un nome valido,
  // l'oggetto non deve nascere e basta, o al secondo tentativo se ne
  // ritroverebbe due.
  const category = await categoryFromForm(form);
  if (!category.ok) return { error: category.error };

  const asset = await db.asset.create({
    data: {
      name: name.slice(0, 120),
      description: description || null,
      location: location || null,
      adminNotes: adminNotes || null,
      categoryId: category.categoryId,
      isBookable,
    },
    select: { id: true },
  });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let skipped = 0;

  for (const [index, file] of files.entries()) {
    const result = await saveAssetPhoto(asset.id, file);
    if (result.ok) {
      // L'ordine è quello in cui si vedono nel selettore, e il primo è quello
      // che finisce in copertina nel catalogo.
      await db.assetPhoto.create({
        data: {
          assetId: asset.id,
          url: result.url,
          thumbUrl: result.thumbUrl,
          sortOrder: index,
        },
      });
    } else {
      // Una foto rifiutata non blocca la creazione dell'oggetto — ma non deve
      // nemmeno sparire in silenzio, com'era prima: si scopriva più tardi che
      // di cinque foto ne erano arrivate tre. Le contiamo e la scheda di
      // modifica lo dice.
      skipped += 1;
    }
  }

  return redirect(
    skipped > 0
      ? `/admin/assets/${asset.id}?skipped=${skipped}`
      : `/admin/assets/${asset.id}`
  );
}

export default function NewAsset({ loaderData, actionData }: Route.ComponentProps) {
  const { categories } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("assets.newHeading")}
        </h1>

        <Form method="post" encType="multipart/form-data" className="mt-8 flex flex-col gap-4">
          <AssetFields categories={categories} />

          <PhotoFields />

          {/* `self-start`: il modulo è una colonna flex, quindi senza questo
              il pulsante si stira per tutta la larghezza e smette di sembrare
              un pulsante. Sulle schermate d'accesso, che sono strette, la
              larghezza piena invece è voluta. */}
          <button
            type="submit"
            disabled={busy}
            className={buttonClass("primary", "md", "self-start")}
          >
            {t("assets.save")}
          </button>
        </Form>

        {actionData?.error && (
          <p role="alert" className="mt-6 rounded-sm bg-out-bg px-3 py-2 text-sm text-out">
            {t(actionData.error)}
          </p>
        )}
      </PageShell>
    </main>
  );
}
