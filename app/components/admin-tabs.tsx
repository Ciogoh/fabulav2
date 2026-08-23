/**
 * Le tre schede del catalogo admin: oggetti, kit, categorie.
 *
 * Stanno **qui e non nell'intestazione**, e la ragione è misurata: il `<nav>`
 * in cima con i sei collegamenti di un admin era già largo 466px dentro a uno
 * schermo da 375, e da lì nasceva lo scorrimento orizzontale di ogni pagina
 * (vedi il blocco in testa a `site-header.tsx`). Altre due voci lassù
 * riaprirebbero quel difetto; qui sono tre bersagli alti 44px che compaiono
 * solo nelle pagine a cui servono.
 *
 * Il collegamento attivo lo decide `NavLink` da solo, e siccome
 * `/admin/assets` è il prefisso di `/admin/assets/new`, la scheda «Oggetti»
 * resta accesa anche mentre se ne crea uno.
 */

import { NavLink } from "react-router";
import { useT } from "~/i18n/use-t";

const TAB =
  "inline-flex min-h-11 items-center border-b-2 border-transparent px-1 text-sm text-muted hover:text-ink aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-ink";

export function AdminTabs() {
  const t = useT();

  return (
    <nav className="-mb-px flex flex-wrap items-center gap-x-6 border-b border-rule">
      <NavLink to="/admin/assets" className={TAB}>
        {t("assets.heading")}
      </NavLink>
      <NavLink to="/admin/kits" className={TAB}>
        {t("kits.heading")}
      </NavLink>
      <NavLink to="/admin/categories" className={TAB}>
        {t("categories.heading")}
      </NavLink>
    </nav>
  );
}
