/**
 * Modifica di un kit — e la sua cancellazione, che vive qui e non
 * nell'elenco: un pulsante rosso accanto a ogni riga di un elenco si preme
 * per sbaglio, dentro alla scheda ci si arriva apposta.
 *
 * Cancellare un kit **non tocca gli oggetti né i prestiti passati**:
 * `KitAsset` sparisce con lui, ma `RequestItem.fromKitId` è `onDelete:
 * SetNull` e le richieste restano dove sono, solo senza più il ricordo di
 * quale kit le aveva riempite.
 */

import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/admin.kits.$id";
import { PageShell, PageTitle } from "~/components/page";
import { buttonClass, ButtonLink } from "~/components/button";
import { useConfirm } from "~/components/confirm";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { assetIdsFrom, assetOptions, replaceKitAssets } from "~/lib/kits.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { KitFields } from "~/components/kit-fields";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "kits.editHeading") }];
}

async function loadKit(id: string) {
  const kit = await db.kit.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      assets: { orderBy: { sortOrder: "asc" }, select: { assetId: true } },
    },
  });
  if (!kit) throw new Response("Not found", { status: 404 });
  return kit;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [kit, assets] = await Promise.all([loadKit(params.id), assetOptions()]);
  return { kit, assets };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const kit = await loadKit(params.id);
  const form = await request.formData();

  if (String(form.get("intent")) === "delete") {
    await db.kit.delete({ where: { id: kit.id } });
    return redirect("/admin/kits");
  }

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "kits.errorName" as TranslationKey };
  }

  const assetIds = assetIdsFrom(form);
  if (assetIds.length === 0) {
    return { error: "kits.errorNoAssets" as TranslationKey };
  }

  const description = String(form.get("description") ?? "").trim();

  await db.kit.update({
    where: { id: kit.id },
    data: { name: name.slice(0, 120), description: description || null },
  });

  await replaceKitAssets(kit.id, assetIds);

  return redirect("/admin/kits");
}

export default function EditKit({ loaderData, actionData }: Route.ComponentProps) {
  const { kit, assets } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const confirm = useConfirm();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("kits.editHeading")} />

        <Form method="post" className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="intent" value="save" />
          <KitFields
            assets={assets}
            defaults={{
              name: kit.name,
              description: kit.description,
              assetIds: kit.assets.map((link) => link.assetId),
            }}
          />

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
          <p role="alert" className="mt-6 rounded-sm bg-out-bg px-3 py-2 text-sm text-out">
            {t(actionData.error)}
          </p>
        )}

        {/* Fuori dal modulo qui sopra: un `<form>` dentro a un altro `<form>`
            non esiste, il lettore di HTML scarta quello interno e la pagina
            che arriva dal server smette di combaciare con quella che React
            ricostruisce nel browser. Vedi la nota in CLAUDE.md. */}
        <Form
          method="post"
          className="mt-10 border-t border-rule pt-6"
          onSubmit={confirm.ask({
            title: t("kits.confirmDelete"),
            body: t("kits.deleteHint"),
            confirmLabel: t("kits.delete"),
          })}
        >
          <input type="hidden" name="intent" value="delete" />
          <button type="submit" disabled={busy} className={buttonClass("danger")}>
            {t("kits.delete")}
          </button>
          <p className="mt-2 text-sm text-muted">{t("kits.deleteHint")}</p>
        </Form>

        {confirm.dialog}
      </PageShell>
    </main>
  );
}
