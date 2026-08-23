/**
 * Il nome — e, se si vuole, una password — chiesti una volta sola.
 *
 * Entrando con un codice, Better Auth crea l'account con la parte davanti alla
 * chiocciola come nome. Va bene per farlo esistere, non va bene per l'admin che
 * deve decidere su una richiesta: `m.rossi91` non dice chi è. Quindi lo
 * chiediamo subito dopo il primo accesso, e mai più.
 *
 * Nome e cognome separati, e un alias facoltativo: gli stessi tre campi del
 * profilo, e non un campo «nome» unico che poi il profilo avrebbe spezzato a
 * modo suo. Chi si presenta come «Vale» resta «Vale» ovunque, ma l'admin che
 * gli consegna un proiettore in magazzino sa che è Valentina Rossi.
 *
 * La password è facoltativa: chi non la imposta continua a entrare col
 * codice, esattamente come oggi. Chi la imposta può scegliere ogni volta —
 * `auth.api.setPassword` è la funzione server di Better Auth pensata proprio
 * per questo caso (un account senza password che se ne aggiunge una prima),
 * a differenza di `changePassword`, che ne pretende già una esistente.
 */

import { Form, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/welcome";
import { pageTitle } from "~/i18n/meta";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { db } from "~/lib/db.server";
import { auth } from "~/lib/auth.server";
import { requireUser } from "~/lib/session.server";
import { getLang } from "~/i18n/lang.server";
import type { Language } from "~/generated/prisma/enums";
import { useT } from "~/i18n/use-t";
import { MAX_ALIAS, MAX_NAME_PART, MIN_NAME_PART, splitName } from "~/lib/person";

const MIN_PASSWORD_LENGTH = 10;

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "welcome.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const guessed = splitName(user.name);

  return {
    firstName: user.firstName ?? guessed.firstName,
    lastName: user.lastName ?? guessed.lastName,
    alias: user.alias ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const alias = String(form.get("alias") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const rawNext = String(form.get("next") ?? "/");
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (firstName.length < MIN_NAME_PART || lastName.length < MIN_NAME_PART) {
    return { error: "welcome.nameRequired" as const };
  }
  if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
    return { error: "welcome.passwordTooShort" as const };
  }
  if (password.length > 0 && password !== confirmPassword) {
    return { error: "welcome.passwordMismatch" as const };
  }

  const first = firstName.slice(0, MAX_NAME_PART);
  const last = lastName.slice(0, MAX_NAME_PART);

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: first,
      lastName: last,
      alias: alias ? alias.slice(0, MAX_ALIAS) : null,
      // `name` resta allineato: è il campo che legge Better Auth.
      name: `${first} ${last}`,
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
    <main>
      <PageShell width="form" className="py-16">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("welcome.heading")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("welcome.intro")}</p>

        <Form method="post" className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="next" value={searchParams.get("next") ?? "/"} />

          <div className="flex flex-wrap gap-4">
            <NameField
              label={t("account.firstName")}
              name="firstName"
              defaultValue={loaderData.firstName}
              autoComplete="given-name"
              maxLength={MAX_NAME_PART}
              required
            />
            <NameField
              label={t("account.lastName")}
              name="lastName"
              defaultValue={loaderData.lastName}
              autoComplete="family-name"
              maxLength={MAX_NAME_PART}
              required
            />
          </div>

          <NameField
            label={t("account.alias")}
            name="alias"
            defaultValue={loaderData.alias}
            autoComplete="nickname"
            maxLength={MAX_ALIAS}
            hint={t("account.aliasHint")}
          />

          <div className="mt-2 rounded border border-rule bg-sunk/40 p-4">
            <p className="text-sm text-muted">{t("welcome.passwordIntro")}</p>

            <div className="mt-4 flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
              >
                {t("welcome.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                className="min-h-11 rounded border border-rule bg-card px-3 py-2.5 text-sm"
              />
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label
                htmlFor="confirmPassword"
                className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
              >
                {t("welcome.confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                className="min-h-11 rounded border border-rule bg-card px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className={buttonClass("primary")}
          >
            {t("welcome.save")}
          </button>
        </Form>

        {actionData?.error && (
          <p role="alert" className="mt-6 rounded bg-out-bg px-3 py-2 text-sm text-out">
            {t(actionData.error)}
          </p>
        )}
      </PageShell>
    </main>
  );
}

function NameField({
  label,
  name,
  defaultValue,
  autoComplete,
  maxLength,
  required,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  autoComplete: string;
  maxLength: number;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        minLength={required ? MIN_NAME_PART : undefined}
        maxLength={maxLength}
        className="min-h-11 rounded border border-rule bg-card px-3 py-2.5 text-sm"
      />
      {hint && <span className="text-[0.8rem] text-muted">{hint}</span>}
    </div>
  );
}
