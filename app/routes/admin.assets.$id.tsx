/**
 * Modifica di un oggetto: campi, galleria delle foto esistenti (con
 * rimozione), e un campo per aggiungerne altre nello stesso salvataggio.
 */

import { Form, useFetcher, useNavigation } from "react-router";
import type { Route } from "./+types/admin.assets.$id";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { deleteAssetPhotoFiles, saveAssetPhoto } from "~/lib/uploads.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { AssetFields } from "~/components/asset-fields";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
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
  const categoryId = String(form.get("categoryId") ?? "") || null;
  const isBookable = form.get("unavailable") !== "on";

  await db.asset.update({
    where: { id: asset.id },
    data: {
      name: name.slice(0, 120),
      description: description || null,
      location: location || null,
      adminNotes: adminNotes || null,
      categoryId,
      isBookable,
    },
  });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let photoError: TranslationKey | null = null;
  for (const file of files) {
    const result = await saveAssetPhoto(asset.id, file);
    if (result.ok) {
      await db.assetPhoto.create({
        data: { assetId: asset.id, url: result.url, thumbUrl: result.thumbUrl },
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

  return (
    <main className="mx-auto w-full max-w-lg px-6 pb-24 pt-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {t("assets.editHeading")}
      </h1>

      {asset.photos.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-3">
          {asset.photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} />
          ))}
        </ul>
      )}

      <Form method="post" encType="multipart/form-data" className="mt-6 flex flex-col gap-4">
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="photos"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
          >
            {t("assets.addPhoto")}
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

type Photo = { id: string; url: string; thumbUrl: string };

function PhotoTile({ photo }: { photo: Photo }) {
  const t = useT();
  const fetcher = useFetcher();
  const removing = fetcher.state !== "idle";

  return (
    <li className="relative h-24 w-24 overflow-hidden rounded border border-rule">
      <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
      <fetcher.Form method="post" className="absolute inset-x-0 bottom-0">
        <input type="hidden" name="intent" value="deletePhoto" />
        <input type="hidden" name="photoId" value={photo.id} />
        <button
          type="submit"
          disabled={removing}
          className="w-full bg-ink/70 py-1 text-[0.65rem] uppercase tracking-wider text-white hover:bg-out"
        >
          {t("assets.removePhoto")}
        </button>
      </fetcher.Form>
    </li>
  );
}
