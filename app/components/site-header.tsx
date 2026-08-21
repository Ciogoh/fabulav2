/**
 * L'intestazione: il nome, i due collegamenti, il selettore di lingua.
 *
 * Volutamente scarna. Chi arriva deve trovarsi davanti il catalogo, non una
 * barra di navigazione da studiare.
 */

import { Link, useFetcher, useLocation, useNavigate } from "react-router";
import { LANGUAGE_NAMES, LANGUAGES } from "~/i18n/dictionaries";
import { useLang, useT } from "~/i18n/use-t";
import { authClient } from "~/lib/auth-client";

export type HeaderUser = {
  name: string;
  email: string;
  isAdmin: boolean;
};

export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const t = useT();
  const navigate = useNavigate();
  const lang = useLang();
  const location = useLocation();
  const fetcher = useFetcher();

  return (
    <header className="border-b border-rule bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Link
          to="/"
          className="font-serif text-2xl font-semibold tracking-tight text-ink"
        >
          {t("app.name")}
          <span className="text-accent">.</span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link to="/" className="text-muted hover:text-ink">
            {t("nav.catalogue")}
          </Link>
          <Link to="/calendar" className="text-muted hover:text-ink">
            {t("nav.calendar")}
          </Link>
          <Link to="/requests" className="text-muted hover:text-ink">
            {t("nav.myRequests")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <fetcher.Form method="post" action="/language">
            {/* Torniamo esattamente dove eravamo, filtri di ricerca compresi. */}
            <input
              type="hidden"
              name="redirectTo"
              value={location.pathname + location.search}
            />
            <label className="sr-only" htmlFor="lang-select">
              {t("nav.language")}
            </label>
            <select
              id="lang-select"
              name="lang"
              defaultValue={lang}
              onChange={(event) => fetcher.submit(event.currentTarget.form)}
              className="rounded border border-rule bg-card px-2 py-1.5 font-mono text-xs text-muted hover:text-ink focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_NAMES[code]}
                </option>
              ))}
            </select>
          </fetcher.Form>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted" title={user.email}>
                {user.name}
              </span>
              <button
                type="button"
                onClick={() =>
                  // `navigate` e non un ricaricamento: il loader di root
                  // rilegge la sessione e l'intestazione si aggiorna da sola.
                  void authClient
                    .signOut()
                    .then(() => navigate("/", { replace: true }))
                }
                className="rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-out hover:text-out"
              >
                {t("nav.signOut")}
              </button>
            </div>
          ) : (
            <Link
              to="/signin"
              className="rounded border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:border-accent hover:text-accent"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
