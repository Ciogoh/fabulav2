/**
 * Modifica di un oggetto: i campi, le foto che ci sono e quelle che si stanno
 * aggiungendo, tutto nello stesso salvataggio.
 */

import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.assets.$id";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { deleteAssetPhotoFiles, saveAssetPhoto } from "~/lib/uploads.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { categoryFromForm } from "~/lib/categories.server";
import { AssetFields } from "~/components/asset-fields";
import { PhotoFields } from "~/components/photo-picker";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "assets.editHeading") }];
}

async function loadAsset(id: string) {
  const asset = await db.asset.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      location: true,
      adminNotes: true,
      isBookable: true,
      categoryId: true,
      photos: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, thumbUrl: true } },
    },
  });
  if (!asset) throw new Response("Not found", { status: 404 });
  return asset;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [asset, categories] = await Promise.all([
    loadAsset(params.id),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return { asset, categories };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const asset = await loadAsset(params.id);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");

  /**
   * La copertina è semplicemente la prima per `sortOrder`, che è come la
   * legge il catalogo. Per promuoverne una basta darle un numero più basso di
   * tutte le altre: nessuna rinumerazione, nessuna transazione, e due admin
   * che premono insieme non si pestano i piedi.
   */
  if (intent === "setCover") {
    const photoId = String(form.get("photoId") ?? "");
    if (asset.photos.some((p) => p.id === photoId)) {
      const lowest = await db.assetPhoto.aggregate({
        where: { assetId: asset.id },
        _min: { sortOrder: true },
      });
      await db.assetPhoto.update({
        where: { id: photoId },
        data: { sortOrder: (lowest._min.sortOrder ?? 0) - 1 },
      });
    }
    return { ok: true as const, intent };
  }

  if (intent === "deletePhoto") {
    const photoId = String(form.get("photoId") ?? "");
    const photo = asset.photos.find((p) => p.id === photoId);
    if (photo) {
      await db.assetPhoto.delete({ where: { id: photo.id } });
      await deleteAssetPhotoFiles(photo.url, photo.thumbUrl);
    }
    return { ok: true as const, intent };
  }

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) {
    return { ok: false as const, error: "assets.errorName" as TranslationKey };
  }

  const description = String(form.get("description") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const adminNotes = String(form.get("adminNotes") ?? "").trim();
  const isBookable = form.get("unavailable") !== "on";

  const category = await categoryFromForm(form);
  if (!category.ok) return { ok: false as const, error: category.error };

  await db.asset.update({
    where: { id: asset.id },
    data: {
      name: name.slice(0, 120),
      description: description || null,
      location: location || null,
      adminNotes: adminNotes || null,
      categoryId: category.categoryId,
      isBookable,
    },
  });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let photoError: TranslationKey | null = null;

  /* Le nuove vanno in fondo, in coda a quelle che ci sono. Prima nessuno
     scriveva `sortOrder`: restavano tutte a zero, e quale finiva in copertina
     nel catalogo lo decideva l'ordine in cui il database le restituiva. */
  const highest = await db.assetPhoto.aggregate({
    where: { assetId: asset.id },
    _max: { sortOrder: true },
  });
  let sortOrder = (highest._max.sortOrder ?? -1) + 1;

  for (const file of files) {
    const result = await saveAssetPhoto(asset.id, file);
    if (result.ok) {
      await db.assetPhoto.create({
        data: {
          assetId: asset.id,
          url: result.url,
          thumbUrl: result.thumbUrl,
          sortOrder: sortOrder++,
        },
      });
    } else {
      photoError =
        result.error === "tooBig" ? "assets.errorPhotoTooBig" : "assets.errorPhotoType";
    }
  }

  return { ok: true as const, intent: "save", error: photoError ?? undefined };
}

export default function EditAsset({ loaderData, actionData }: Route.ComponentProps) {
  const { asset, categories } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  /* La pagina «nuovo oggetto» finisce qui con un redirect, quindi un suo
     messaggio d'errore non sopravviverebbe al viaggio: le foto scartate le
     conta lei e ce le passa nell'indirizzo. */
  const [searchParams] = useSearchParams();
  const skipped = Number(searchParams.get("skipped") ?? 0);

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("assets.editHeading")}
        </h1>

        <Form method="post" encType="multipart/form-data" className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="intent" value="save" />
          <AssetFields
            categories={categories}
            defaults={{
              name: asset.name,
              description: asset.description,
              location: asset.location,
              categoryId: asset.categoryId,
              adminNotes: asset.adminNotes,
              isBookable: asset.isBookable,
            }}
          />

          <PhotoFields existing={asset.photos} />

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

        {skipped > 0 && (
          <p role="alert" className="mt-6 rounded bg-out-bg px-3 py-2 text-sm text-out">
            {t("assets.photoSkipped", { count: skipped })}
          </p>
        )}

        {actionData?.error && (
          <p role="alert" className="mt-6 rounded bg-out-bg px-3 py-2 text-sm text-out">
            {t(actionData.error)}
          </p>
        )}
      </PageShell>
    </main>
  );
}
