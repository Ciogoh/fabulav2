/**
 * Il proprio profilo: la foto, il nome e come ci si fa chiamare.
 *
 * Ci si arriva premendo il proprio nome nell'intestazione — il posto in cui
 * chiunque lo cerca per prima cosa.
 *
 * Tre decisioni:
 *
 * - **Nome e cognome separati.** `name` da solo diventava «m.rossi91» o «sa»,
 *   e un admin che deve consegnare un oggetto di persona non sa a chi lo sta
 *   dando. Restano obbligatori.
 * - **L'alias è facoltativo** ed è quello che si vede ovunque. Chi non lo
 *   mette continua a comparire col nome e cognome, come prima.
 * - **`name` resta allineato** a «nome cognome» a ogni salvataggio: è il campo
 *   che Better Auth pretende, e lo leggono le email di reimposta password.
 *
 * Due moduli separati e non uno solo: la foto viaggia come `multipart` e si
 * manda da sola appena la scegli, il resto è testo. Un modulo unico avrebbe
 * costretto a ricaricare l'immagine a ogni correzione di una virgola nel nome.
 */

import { Form, useFetcher, useNavigation } from "react-router";
import type { Route } from "./+types/account";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { deleteAvatarFile, saveAvatar } from "~/lib/uploads.server";
import {
  MAX_ALIAS,
  MAX_NAME_PART,
  MIN_NAME_PART,
  type Person,
} from "~/lib/person";
import { useT } from "~/i18n/use-t";
import { PageShell, PageTitle } from "~/components/page";
import { Button, buttonClass } from "~/components/button";
import { Avatar, PersonName } from "~/components/person";
import type { TranslationKey } from "~/i18n/dictionaries";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "account.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  return {
    person: {
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      alias: user.alias,
      image: user.image,
    } satisfies Person,
    email: user.email,
  };
}

export async function action({ request }: Route.ActionArgs) {
  // Prima riga, sempre: qui si scrive sul profilo di chi chiama, e l'unico
  // profilo che può toccare è il proprio — l'id non arriva mai dal modulo.
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "photo") {
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, error: "account.errorNoPhoto" as TranslationKey };
    }

    const saved = await saveAvatar(user.id, file);
    if (!saved.ok) {
      return {
        ok: false as const,
        error: (saved.error === "tooBig"
          ? "account.errorPhotoTooBig"
          : "account.errorPhotoType") as TranslationKey,
      };
    }

    // Prima si scrive il nuovo indirizzo, poi si cancella il vecchio file: al
    // contrario, un errore in mezzo lascerebbe una scheda che punta a un file
    // che non c'è più.
    await db.user.update({ where: { id: user.id }, data: { image: saved.url } });
    await deleteAvatarFile(user.image);

    return { ok: true as const };
  }

  if (intent === "removePhoto") {
    await db.user.update({ where: { id: user.id }, data: { image: null } });
    await deleteAvatarFile(user.image);
    return { ok: true as const };
  }

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const alias = String(form.get("alias") ?? "").trim();

  if (firstName.length < MIN_NAME_PART || lastName.length < MIN_NAME_PART) {
    return { ok: false as const, error: "account.errorNameRequired" as TranslationKey };
  }

  const first = firstName.slice(0, MAX_NAME_PART);
  const last = lastName.slice(0, MAX_NAME_PART);

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: first,
      lastName: last,
      alias: alias ? alias.slice(0, MAX_ALIAS) : null,
      // `name` non è un doppione da tenere per pigrizia: è il campo di Better
      // Auth, e se non lo aggiorniamo la reimposta password continua a
      // salutare qualcuno col nome di due anni fa.
      name: `${first} ${last}`,
    },
  });

  return { ok: true as const };
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { person, email } = loaderData;
  const t = useT();
  const navigation = useNavigation();
  const photoFetcher = useFetcher<typeof action>();

  const savingProfile = navigation.state !== "idle";
  const savingPhoto = photoFetcher.state !== "idle";
  const photoError = photoFetcher.data && !photoFetcher.data.ok ? photoFetcher.data.error : null;
  const profileError = actionData && !actionData.ok ? actionData.error : null;
  // Un modulo che non dice niente quando riesce sembra un modulo rotto: qui
  // il salvataggio non cambia pagina, quindi senza una riga di conferma
  // l'unico segnale sarebbe il nome che cambia là in cima.
  const profileSaved = actionData?.ok === true && !savingProfile;

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("account.heading")} intro={t("account.intro")} />

        {/* ------------------------------------------------------- foto */}
        <section className="mt-8 flex flex-wrap items-center gap-5">
          <Avatar person={person} size="lg" alt={t("account.photoAlt")} />

          <div className="flex flex-col gap-2">
            <photoFetcher.Form method="post" encType="multipart/form-data">
              <input type="hidden" name="intent" value="photo" />
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                  {t("account.photo")}
                </span>
                {/* Si manda da sé appena scegli il file: un pulsante «carica»
                    in più sarebbe un passaggio che nessuno si aspetta. */}
                <input
                  type="file"
                  name="photo"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={savingPhoto}
                  onChange={(event) => {
                    if (event.currentTarget.files?.length) {
                      photoFetcher.submit(event.currentTarget.form);
                    }
                  }}
                  className="text-sm"
                />
              </label>
            </photoFetcher.Form>

            <p className="text-[0.8rem] text-muted">{t("account.photoHint")}</p>

            {person.image && (
              <photoFetcher.Form method="post">
                <input type="hidden" name="intent" value="removePhoto" />
                <Button type="submit" variant="danger" size="sm" disabled={savingPhoto}>
                  {t("account.removePhoto")}
                </Button>
              </photoFetcher.Form>
            )}
          </div>
        </section>

        {photoError && (
          <p role="alert" className="mt-4 rounded bg-out-bg px-3 py-2 text-sm text-out">
            {t(photoError)}
          </p>
        )}
        {savingPhoto && (
          <p aria-live="polite" className="mt-4 text-sm text-muted">
            {t("account.uploading")}
          </p>
        )}

        {/* ------------------------------------------------------- nome */}
        <Form method="post" className="mt-10 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <Field
              label={t("account.firstName")}
              name="firstName"
              defaultValue={person.firstName ?? ""}
              autoComplete="given-name"
              required
            />
            <Field
              label={t("account.lastName")}
              name="lastName"
              defaultValue={person.lastName ?? ""}
              autoComplete="family-name"
              required
            />
          </div>

          <Field
            label={t("account.alias")}
            name="alias"
            defaultValue={person.alias ?? ""}
            autoComplete="nickname"
            maxLength={MAX_ALIAS}
            hint={t("account.aliasHint")}
          />

          <p className="text-[0.8rem] text-muted">
            {t("account.preview")}{" "}
            <PersonName person={person} className="font-medium text-ink" />
          </p>

          {profileError && (
            <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
              {t(profileError)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingProfile}
              className={buttonClass("primary")}
            >
              {t("account.save")}
            </button>
            <p aria-live="polite" className="text-sm text-free">
              {profileSaved ? t("account.saved") : ""}
            </p>
          </div>
        </Form>

        {/* L'indirizzo non si cambia da qui: è l'identità con cui si entra, e
            spostarla vuol dire un codice di conferma sul nuovo indirizzo —
            un pezzo che oggi non c'è. Meglio dirlo che lasciare un campo
            che non funziona. */}
        <p className="mt-10 border-t border-rule pt-5 text-sm text-muted">
          {t("account.email")}: <span className="text-ink">{email}</span>
          <br />
          <span className="text-[0.8rem]">{t("account.emailHint")}</span>
        </p>
      </PageShell>
    </main>
  );
}

function Field({
  label,
  name,
  defaultValue,
  autoComplete,
  required,
  hint,
  maxLength = MAX_NAME_PART,
}: {
  label: string;
  name: string;
  defaultValue: string;
  autoComplete: string;
  required?: boolean;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        className="min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"
      />
      {hint && <span className="text-[0.8rem] text-muted">{hint}</span>}
    </div>
  );
}
