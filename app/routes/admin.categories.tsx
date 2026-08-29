/**
 * Le categorie: crearle, rinominarle, metterle in ordine, toglierle.
 *
 * Sono la spina dorsale del catalogo — l'ordine di questa pagina è l'ordine
 * in cui il pubblico vede i gruppi — ma restano una pagina di servizio: nel
 * lavoro di tutti i giorni la categoria si crea da dentro la scheda
 * dell'oggetto (vedi `categories.server.ts`), e qui si viene solo per
 * riordinare o per correggere un nome.
 *
 * **Rinominare non cambia lo slug**, e non è una dimenticanza: lo slug sta
 * negli indirizzi del catalogo (`/?cat=audio`), che la gente si scambia e si
 * tiene nei segnalibri. Un nome corretto non deve rompere un collegamento
 * mandato la settimana scorsa.
 *
 * Cancellare una categoria **non cancella gli oggetti**: restano lì, senza
 * categoria, e il conto accanto al pulsante dice quanti sono prima di
 * premere.
 */

import { useState } from "react";
import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/admin.categories";
import { PageShell, PageTitle } from "~/components/page";
import { buttonClass } from "~/components/button";
import { useConfirm } from "~/components/confirm";
import { AdminTabs } from "~/components/admin-tabs";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { cleanCategoryName, slugify, MAX_CATEGORY_NAME } from "~/lib/categories";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "categories.heading") }];
}

/** Un ordine solo, usato sia per mostrare sia per spostare: se le due liste
 *  non combaciassero, la freccia «su» sposterebbe la riga sbagliata. */
const ORDER = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const categories = await db.category.findMany({
    orderBy: ORDER,
    select: {
      id: true,
      name: true,
      slug: true,
      // Conteggio filtrato: gli archiviati non stanno più nel catalogo,
      // quindi non vanno contati accanto alla categoria che li raggruppa.
      _count: { select: { assets: { where: { archivedAt: null } } } },
    },
  });

  const orphans = await db.asset.count({
    where: { categoryId: null, archivedAt: null },
  });

  return { categories, orphans };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "create") {
    const name = cleanCategoryName(String(form.get("name") ?? ""));
    if (name.length < 2) {
      return { ok: false as const, error: "categories.errorName" as TranslationKey };
    }

    const slug = slugify(name) || `cat-${Date.now().toString(36)}`;
    const clash = await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (clash) {
      // Da dentro la scheda di un oggetto un doppione si riusa in silenzio,
      // ma qui il gesto è «creane una»: se non compare niente di nuovo
      // bisogna dire perché.
      return { ok: false as const, error: "categories.errorDuplicate" as TranslationKey };
    }

    const last = await db.category.aggregate({ _max: { sortOrder: true } });
    await db.category.create({
      data: { name, slug, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return { ok: true as const, intent };
  }

  const id = String(form.get("id") ?? "");
  const category = await db.category.findUnique({ where: { id }, select: { id: true } });
  if (!category) {
    return { ok: false as const, error: "categories.errorGeneric" as TranslationKey };
  }

  if (intent === "rename") {
    const name = cleanCategoryName(String(form.get("name") ?? ""));
    if (name.length < 2) {
      return { ok: false as const, error: "categories.errorName" as TranslationKey };
    }
    await db.category.update({ where: { id }, data: { name } });
    return { ok: true as const, intent };
  }

  if (intent === "move") {
    const step = String(form.get("direction")) === "up" ? -1 : 1;
    const all = await db.category.findMany({ orderBy: ORDER, select: { id: true } });

    const from = all.findIndex((c) => c.id === id);
    const to = from + step;
    if (from === -1 || to < 0 || to >= all.length) return { ok: true as const, intent };

    const moved = [...all];
    [moved[from], moved[to]] = [moved[to], moved[from]];

    /* Rinumerate tutte, non scambiati i due valori: le categorie nate dal
       seed condividono lo stesso `sortOrder`, e scambiare due zeri non
       sposta niente. Sono una manciata di righe, la transazione è breve. */
    await db.$transaction(
      moved.map((c, index) =>
        db.category.update({ where: { id: c.id }, data: { sortOrder: index } })
      )
    );
    return { ok: true as const, intent };
  }

  if (intent === "delete") {
    // Gli oggetti sopravvivono: `categoryId` è `onDelete: SetNull`.
    await db.category.delete({ where: { id } });
    return { ok: true as const, intent };
  }

  return { ok: false as const, error: "categories.errorGeneric" as TranslationKey };
}

type CategoryRow = Route.ComponentProps["loaderData"]["categories"][number];

export default function AdminCategories({ loaderData, actionData }: Route.ComponentProps) {
  const { categories, orphans } = loaderData;
  const t = useT();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("categories.heading")} intro={t("categories.intro")} />

        <div className="mt-6">
          <AdminTabs />
        </div>

        <NewCategoryForm />

        {actionData?.error && (
          <p role="alert" className="mt-4 rounded-sm bg-out-bg px-3 py-2 text-sm text-out">
            {t(actionData.error)}
          </p>
        )}

        {categories.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("categories.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {categories.map((category, index) => (
              <CategoryItem
                key={category.id}
                category={category}
                first={index === 0}
                last={index === categories.length - 1}
              />
            ))}
          </ul>
        )}

        {orphans > 0 && (
          <p className="mt-6 text-sm text-muted">
            <Link to="/admin/assets?cat=-" className="underline underline-offset-4 hover:text-ink">
              {t("categories.orphans", { count: orphans })}
            </Link>
          </p>
        )}
      </PageShell>
    </main>
  );
}

/**
 * Il campo per crearne una.
 *
 * Sta in cima e non dietro a un pulsante «aggiungi»: è l'unica azione per cui
 * si arriva qui la prima volta, e un campo già aperto toglie un click a un
 * gesto che si fa in tre secondi. Si svuota da solo quando il salvataggio è
 * andato a buon fine, perché la voglia di scriverne subito un'altra è alta.
 */
function NewCategoryForm() {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  const [name, setName] = useState("");
  const busy = fetcher.state !== "idle";

  /* Il campo si svuota una volta sola, alla risposta. Guardare il solo
     `fetcher.data.ok` non basta: quel valore resta lì dopo la creazione, e
     cancellerebbe ogni lettera del nome successivo mentre la si scrive. Il
     confronto con la risposta già vista è il modo di React di reagire a un
     cambiamento senza un `useEffect` da tenere allineato. */
  const [seen, setSeen] = useState<unknown>(null);
  if (fetcher.data !== seen) {
    setSeen(fetcher.data);
    if (fetcher.data?.ok) setName("");
  }

  return (
    <fetcher.Form method="post" className="mt-6 flex flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value="create" />
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label
          htmlFor="new-category"
          className="eyebrow"
        >
          {t("categories.new")}
        </label>
        <input
          id="new-category"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={MAX_CATEGORY_NAME}
          placeholder={t("categories.newPlaceholder")}
          className="field"
        />
      </div>
      <button type="submit" disabled={busy} className={buttonClass("primary")}>
        {t("categories.add")}
      </button>
    </fetcher.Form>
  );
}

function CategoryItem({
  category,
  first,
  last,
}: {
  category: CategoryRow;
  first: boolean;
  last: boolean;
}) {
  const t = useT();
  const rename = useFetcher<typeof action>();
  const remove = useFetcher<typeof action>();
  const [name, setName] = useState(category.name);
  const changed = name.trim() !== category.name;
  const count = category._count.assets;
  const confirm = useConfirm();

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-sm border border-rule bg-card p-3">
      <rename.Form method="post" className="flex min-w-48 flex-1 items-center gap-2">
        <input type="hidden" name="intent" value="rename" />
        <input type="hidden" name="id" value={category.id} />
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={MAX_CATEGORY_NAME}
          aria-label={t("categories.name")}
          className="field w-full"
        />
        {/* Compare solo quando c'è davvero qualcosa da salvare: un pulsante
            sempre acceso accanto a ogni riga è un invito a premere a vuoto. */}
        {changed && (
          <button
            type="submit"
            disabled={rename.state !== "idle"}
            className={buttonClass("secondary", "sm")}
          >
            {t("categories.save")}
          </button>
        )}
      </rename.Form>

      <Link
        to={`/admin/assets?cat=${encodeURIComponent(category.slug)}`}
        className="font-mono text-2xs uppercase tracking-wider text-muted underline underline-offset-4 hover:text-ink"
      >
        {t("categories.itemCount", { count })}
      </Link>

      <div className="flex items-center gap-1">
        <MoveButton category={category} direction="up" disabled={first} />
        <MoveButton category={category} direction="down" disabled={last} />

        <remove.Form
          method="post"
          onSubmit={confirm.ask({
            title:
              count > 0
                ? t("categories.confirmDeleteWithItems", { count })
                : t("categories.confirmDelete"),
            confirmLabel: t("categories.delete"),
          })}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={category.id} />
          <button
            type="submit"
            disabled={remove.state !== "idle"}
            className={buttonClass("danger", "sm")}
          >
            {t("categories.delete")}
          </button>
        </remove.Form>
      </div>

      {confirm.dialog}
    </li>
  );
}

/** Su e giù. Le frecce sono decorazione: il nome dell'azione lo porta
 *  `aria-label`, o da lettore di schermo sarebbero due pulsanti muti. */
function MoveButton({
  category,
  direction,
  disabled,
}: {
  category: CategoryRow;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="move" />
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled || fetcher.state !== "idle"}
        aria-label={direction === "up" ? t("categories.moveUp") : t("categories.moveDown")}
        className={buttonClass("quiet", "sm", "w-9 px-0")}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3"
        >
          {direction === "up" ? <path d="M2.5 7.5 6 4l3.5 3.5" /> : <path d="M2.5 4.5 6 8l3.5-3.5" />}
        </svg>
      </button>
    </fetcher.Form>
  );
}
