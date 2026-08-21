/**
 * Il nome — e, se si vuole, una password — chiesti una volta sola.
 *
 * Entrando con un codice, Better Auth crea l'account con la parte davanti alla
 * chiocciola come nome. Va bene per farlo esistere, non va bene per l'admin che
 * deve decidere su una richiesta: `m.rossi91` non dice chi è. Quindi lo
 * chiediamo subito dopo il primo accesso, e mai più.
 *
 * La password è facoltativa: chi non la imposta continua a entrare col
 * codice, esattamente come oggi. Chi la imposta può scegliere ogni volta —
 * `auth.api.setPassword` è la funzione server di Better Auth pensata proprio
 * per questo caso (un account senza password che se ne aggiunge una prima),
 * a differenza di `changePassword`, che ne pretende già una esistente.
 */

import { Form, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/welcome";
import { db } from "~/lib/db.server";
import { auth } from "~/lib/auth.server";
import { requireUser } from "~/lib/session.server";
import { getLang } from "~/i18n/lang.server";
import type { Language } from "~/generated/prisma/enums";
import { useT } from "~/i18n/use-t";

const MIN_PASSWORD_LENGTH = 10;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { suggestion: user.name };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const rawNext = String(form.get("next") ?? "/");
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (name.length < 2) {
    return { error: "welcome.nameRequired" as const };
  }
  if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
    return { error: "welcome.passwordTooShort" as const };
  }
  if (password.length > 0 && password !== confirmPassword) {
    return { error: "welcome.passwordMismatch" as const };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      name: name.slice(0, 80),
      // Il profilo nasce in inglese, ma questa persona stava già sfogliando il
      // catalogo in una lingua: senza questa riga, appena registrata si
      // ritroverebbe il sito in inglese senza aver chiesto niente.
      language: getLang(request).toUpperCase() as Language,
    },
  });

  if (password.length > 0) {
    try {
      await auth.api.setPassword({
        body: { newPassword: password },
        headers: request.headers,
      });
    } catch (error) {
      console.error("Impostazione password al benvenuto fallita:", error);
      return { error: "welcome.passwordFailed" as const };
    }
  }

  return redirect(next);
}

export default function Welcome({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const t = useT();
  const [searchParams] = useSearchParams();

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {t("welcome.heading")}
      </h1>
      <p className="mt-2 text-sm text-muted">{t("welcome.intro")}</p>

      <Form method="post" className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="next" value={searchParams.get("next") ?? "/"} />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
          >
            {t("welcome.name")}
          </label>
          <input
            id="name"
            name="name"
            defaultValue={loaderData.suggestion}
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            className="rounded border border-rule bg-card px-3 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </div>

        <div className="mt-2 rounded border border-rule bg-sunk/40 p-4">
          <p className="text-sm text-muted">{t("welcome.passwordIntro")}</p>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
            >
              {t("welcome.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              className="rounded border border-rule bg-card px-3 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            />
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
            >
              {t("welcome.confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              className="rounded border border-rule bg-card px-3 py-2.5 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded bg-accent px-4 py-2.5 text-sm font-medium text-white"
        >
          {t("welcome.save")}
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
