/**
 * La pagina che riceve il link di reset.
 *
 * Better Auth manda un'email con un indirizzo che, dopo aver verificato il
 * token lato server, reindirizza qui con `?token=...` in coda. Da qui in poi
 * è un form normale: nuova password, conferma, `authClient.resetPassword`.
 *
 * È anche il modo in cui chi è entrato solo col codice via email si
 * aggiunge una password: l'endpoint di Better Auth crea l'account con
 * password se non c'è già, altrimenti la sostituisce.
 */

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/reset-password";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { authClient } from "~/lib/auth-client";
import { useT } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "resetPassword.heading") }];
}

export default function ResetPassword() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError(t("resetPassword.mismatch"));
      return;
    }

    setBusy(true);
    setError(null);

    const { error: failure } = await authClient.resetPassword({
      newPassword,
      token,
    });

    setBusy(false);
    if (failure) return setError(t("resetPassword.failed"));
    navigate("/signin");
  }

  return (
    <main>
      <PageShell width="form" className="py-16">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("resetPassword.heading")}
        </h1>

        {!token ? (
          <p className="mt-4 text-sm text-out">{t("resetPassword.invalidToken")}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{t("resetPassword.intro")}</p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              <Field
                label={t("resetPassword.newPassword")}
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
              <Field
                label={t("resetPassword.confirmPassword")}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
              <button
                type="submit"
                disabled={busy}
                className={buttonClass("primary")}
              >
                {t("resetPassword.submit")}
              </button>
            </form>

            {error && (
              <p role="alert" className="mt-6 rounded bg-out-bg px-3 py-2 text-sm text-out">
                {error}
              </p>
            )}
          </>
        )}
      </PageShell>
    </main>
  );
}

function Field({
  label,
  name,
  ...rest
}: {
  label: string;
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="eyebrow"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="min-h-11 rounded border border-rule bg-card px-3 py-2.5 text-sm"
        {...rest}
      />
    </div>
  );
}
