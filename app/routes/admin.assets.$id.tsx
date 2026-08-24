/**
 * Modifica di un oggetto: i campi, le foto che ci sono e quelle che si stanno
 * aggiungendo, tutto nello stesso salvataggio.
 *
 * In fondo alla pagina c'è **una sola** via d'uscita alla volta, scelta al
 * posto dell'admin invece di mettergliene due davanti:
 *
 * - mai prestato → **elimina**, che lo toglie davvero, foto comprese;
 * - con dei prestiti alle spalle → **archivia**, perché `RequestItem.asset` è
 *   `onDelete: Restrict` e cancellarlo vorrebbe dire cancellare lo storico di
 *   chi l'ha avuto;
 * - già archiviato → **rimetti in catalogo**.
 *
 * Chi archivia sta dicendo «questa cosa non è più nostra»: venduta, persa,
 * rotta per sempre. È diverso da «non prestabile», che è temporaneo e lascia
 * l'oggetto in vetrina.
 */

import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.assets.$id";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { logAdminAction } from "~/lib/audit.server";
import { deleteAssetPhotoFiles, saveAssetPhoto } from "~/lib/uploads.server";
import { useFormatDay, useT } from "~/i18n/use-t";
import { Avatar, PersonName } from "~/components/person";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
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
      archivedAt: true,
      categoryId: true,
      photos: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, thumbUrl: true } },
      // Quanti prestiti ha alle spalle: è questo numero, e non una spunta, a
      // decidere se l'oggetto si può cancellare o solo archiviare.
      _count: { select: { requestItems: true } },
    },
  });
  if (!asset) throw new Response("Not found", { status: 404 });
  return asset;
}

/**
 * Chi ha avuto questo oggetto, e quando.
 *
 * Sta qui e non sulla scheda pubblica (`item.tsx`) per la regola di sicurezza
 * che vale in tutto il progetto: **nessun nome di persona nelle superfici
 * pubbliche**. Il catalogo dice che un oggetto è occupato, non chi ce l'ha —
 * questa pagina invece è già dietro `requireAdmin`.
 *
 * Nessuna tabella nuova: i dati ci sono già tutti su `RequestItem` e
 * `Request`. Lo storico non è un dato da raccogliere, è una lettura di quello
 * che il prestito lascia dietro di sé.
 */
async function loadHistory(assetId: string) {
  return db.requestItem.findMany({
    where: { assetId },
    orderBy: { request: { startDate: "desc" } },
    select: {
      id: true,
      pickedUpAt: true,
      returnedAt: true,
      request: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
          user: {
            select: { name: true, firstName: true, lastName: true, alias: true, image: true },
          },
        },
      },
    },
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [asset, categories, history] = await Promise.all([
    loadAsset(params.id),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    loadHistory(params.id),
  ]);

  return {
    asset,
    categories,
    history: history.map((item) => ({
      id: item.id,
      requestId: item.request.id,
      startDate: item.request.startDate.toISOString(),
      endDate: item.request.endDate.toISOString(),
      status: item.request.status,
      holder: item.request.user,
      pickedUp: item.pickedUpAt !== null,
      returned: item.returnedAt !== null,
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
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

  if (intent === "archive") {
    /* Fuori dal catalogo e fuori dai kit, nello stesso colpo. Un kit che
       continuasse a contenerlo mostrerebbe un pezzo che nel selettore non
       esiste più, e al primo salvataggio lo perderebbe in silenzio. */
    await db.$transaction([
      db.asset.update({ where: { id: asset.id }, data: { archivedAt: new Date() } }),
      db.kitAsset.deleteMany({ where: { assetId: asset.id } }),
    ]);

    await logAdminAction({
      actorId: admin.id,
      action: "asset.archived",
      targetType: "Asset",
      targetId: asset.id,
      detail: asset.name,
    });

    return redirect("/admin/assets");
  }

  if (intent === "restore") {
    await db.asset.update({ where: { id: asset.id }, data: { archivedAt: null } });
    return { ok: true as const, intent };
  }

  if (intent === "delete") {
    if (asset._count.requestItems > 0) {
      // L'interfaccia non offre nemmeno il pulsante in questo caso, ma
      // l'indirizzo resta raggiungibile con `curl`: la guardia sta qui.
      return { ok: false as const, error: "assets.errorDeleteHasHistory" as TranslationKey };
    }

    // I file prima della riga: cancellata quella, gli indirizzi delle foto
    // non si sanno più e resterebbero due file orfani sul disco per sempre.
    for (const photo of asset.photos) {
      await deleteAssetPhotoFiles(photo.url, photo.thumbUrl);
    }
    await db.asset.delete({ where: { id: asset.id } });

    // Il nome nel registro è l'unica traccia che resta: la riga
    // dell'oggetto non c'è più, e `targetId` punta al vuoto per costruzione.
    await logAdminAction({
      actorId: admin.id,
      action: "asset.deleted",
      targetType: "Asset",
      targetId: asset.id,
      detail: asset.name,
    });

    return redirect("/admin/assets");
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
  const { asset, categories, history } = loaderData;
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

        {asset.archivedAt && (
          <p className="mt-4 rounded border border-rule bg-sunk px-3 py-2 text-sm text-muted">
            {t("assets.archivedNote")}
          </p>
        )}

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

        <AssetHistory entries={history} />

        <ExitZone
          archived={Boolean(asset.archivedAt)}
          loans={asset._count.requestItems}
          busy={busy}
        />
      </PageShell>
    </main>
  );
}

/**
 * Lo storico dei prestiti, sotto ai campi e sopra alla via d'uscita.
 *
 * È messo lì di proposito: la domanda «questo oggetto vale lo spazio che
 * occupa in magazzino?» si fa proprio nel momento in cui si sta per premere
 * «archivia», e la risposta è questo elenco — dieci prestiti in sei mesi o
 * nessuno da due anni.
 *
 * Ogni riga porta al dettaglio della richiesta invece di ripeterlo qui: chat,
 * date e passaggi di mano esistono già lì, e duplicarli vorrebbe dire tenerli
 * allineati in due posti.
 */
function AssetHistory({
  entries,
}: {
  entries: Route.ComponentProps["loaderData"]["history"];
}) {
  const t = useT();
  const formatDayLabel = useFormatDay();

  return (
    <section className="mt-10 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">
        {t("assets.historyHeading")}
      </h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("assets.historyEmpty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-rule">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/requests/${entry.requestId}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:text-accent"
              >
                <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                  {formatDayLabel(entry.startDate)} — {formatDayLabel(entry.endDate)}
                </span>

                <span className="flex items-center gap-2">
                  <Avatar person={entry.holder} size="sm" />
                  <PersonName person={entry.holder} />
                </span>

                {/* Lo stato del passaggio di mano vince su quello della
                    richiesta quando c'è: «riconsegnato» dice più di
                    «approvata», che a prestito finito è ormai una formalità. */}
                <span className="ml-auto font-mono text-[0.62rem] uppercase tracking-wider text-muted">
                  {entry.returned
                    ? t("requests.item.returned")
                    : entry.pickedUp
                      ? t("requests.item.pickedUp")
                      : t(REQUEST_STATUS_LABELS[entry.status])}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * La via d'uscita, una sola alla volta.
 *
 * Mettere «elimina» e «archivia» uno accanto all'altro obbligherebbe chi
 * amministra a sapere che `RequestItem` ha un vincolo `Restrict` per capire
 * quale dei due funziona. Il numero di prestiti lo sa già la pagina: sceglie
 * lei, e la riga sotto al pulsante dice perché è quello e non l'altro.
 *
 * Ogni modulo sta fuori da quello dei campi: un `<form>` dentro a un altro
 * non esiste, il lettore di HTML scarta quello interno e la pagina che arriva
 * dal server smette di combaciare con quella che React ricostruisce. Vedi la
 * nota in CLAUDE.md.
 */
function ExitZone({
  archived,
  loans,
  busy,
}: {
  archived: boolean;
  loans: number;
  busy: boolean;
}) {
  const t = useT();

  if (archived) {
    return (
      <Form method="post" className="mt-10 border-t border-rule pt-6">
        <input type="hidden" name="intent" value="restore" />
        <button type="submit" disabled={busy} className={buttonClass("secondary")}>
          {t("assets.restore")}
        </button>
        <p className="mt-2 text-sm text-muted">{t("assets.restoreHint")}</p>
      </Form>
    );
  }

  const deletable = loans === 0;

  return (
    <Form
      method="post"
      className="mt-10 border-t border-rule pt-6"
      onSubmit={(event) => {
        const message = deletable
          ? t("assets.confirmDelete")
          : t("assets.confirmArchive");
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value={deletable ? "delete" : "archive"} />
      <button type="submit" disabled={busy} className={buttonClass("danger")}>
        {deletable ? t("assets.delete") : t("assets.archive")}
      </button>
      <p className="mt-2 max-w-prose text-sm text-muted">
        {deletable ? t("assets.deleteHint") : t("assets.archiveHint", { count: loans })}
      </p>
    </Form>
  );
}
