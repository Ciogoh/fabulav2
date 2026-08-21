/**
 * Il nome, chiesto una volta sola.
 *
 * Entrando con un codice, Better Auth crea l'account con la parte davanti alla
 * chiocciola come nome. Va bene per farlo esistere, non va bene per l'admin che
 * deve decidere su una richiesta: `m.rossi91` non dice chi è. Quindi lo
 * chiediamo subito dopo il primo accesso, e mai più.
 */

import { Form, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/welcome";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { getLang } from "~/i18n/lang.server";
import type { Language } from "~/generated/prisma/enums";
import { useT } from "~/i18n/use-t";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { suggestion: user.name };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const rawNext = String(form.get("next") ?? "/");
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (name.length < 2) {
    return { error: "welcome.nameRequired" as const };
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
