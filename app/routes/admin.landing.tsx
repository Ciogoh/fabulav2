/**
 * Il contenuto della landing pubblica: il testo dell'abstract e il video del
 * tutorial. Una pagina admin a sé, non una scheda di `admin-tabs.tsx`: quelle
 * tab sono per le entità del catalogo (oggetti/kit/categorie), mentre questo
 * è un'impostazione globale del sito.
 */

import { useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/admin.landing";
import { PageShell, PageTitle } from "~/components/page";
import { Button, buttonClass } from "~/components/button";
import { useConfirm } from "~/components/confirm";
import { pageTitle } from "~/i18n/meta";
import { useT, useFormatDay } from "~/i18n/use-t";
import { PersonName } from "~/components/person";
import { LANGUAGES, LANGUAGE_NAMES, translate, type Lang, type TranslationKey } from "~/i18n/dictionaries";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { logAdminAction } from "~/lib/audit.server";
import {
  saveTutorialVideo,
  deleteTutorialVideoFile,
  TUTORIAL_VIDEO_ID,
} from "~/lib/uploads.server";
import { MAX_TUTORIAL_VIDEO_BYTES, ACCEPTED_VIDEO_ACCEPT } from "~/lib/uploads.shared";
import { LANDING_CONTENT_ID } from "~/lib/landing-content.server";

const FIELD = {
  en: "abstractEn",
  it: "abstractIt",
  de: "abstractDe",
} as const satisfies Record<Lang, string>;

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "adminLanding.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const [video, content] = await Promise.all([
    db.tutorialVideo.findUnique({
      where: { id: TUTORIAL_VIDEO_ID },
      select: {
        url: true,
        uploadedAt: true,
        uploadedBy: {
          select: { id: true, name: true, firstName: true, lastName: true, alias: true },
        },
      },
    }),
    db.landingContent.findUnique({
      where: { id: LANDING_CONTENT_ID },
      select: { abstractEn: true, abstractIt: true, abstractDe: true },
    }),
  ]);

  const text: Record<Lang, string> = {
    en: content?.abstractEn ?? translate("en", "landing.abstract"),
    it: content?.abstractIt ?? translate("it", "landing.abstract"),
    de: content?.abstractDe ?? translate("de", "landing.abstract"),
  };

  return { video, text };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "saveVideo") {
    const file = form.get("video");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, error: "adminTutorial.errorNoFile" as TranslationKey };
    }

    const result = await saveTutorialVideo(file);
    if (!result.ok) {
      return {
        ok: false as const,
        error:
          result.error === "tooBig"
            ? ("adminTutorial.errorTooBig" as TranslationKey)
            : ("adminTutorial.errorBadType" as TranslationKey),
      };
    }

    // Prima si scrive il nuovo record, solo dopo si cancella il file vecchio:
    // una sostituzione fallita a metà non deve lasciare la landing senza
    // video.
    const previous = await db.tutorialVideo.findUnique({
      where: { id: TUTORIAL_VIDEO_ID },
      select: { url: true },
    });

    await db.tutorialVideo.upsert({
      where: { id: TUTORIAL_VIDEO_ID },
      create: { id: TUTORIAL_VIDEO_ID, url: result.url, uploadedById: admin.id },
      update: { url: result.url, uploadedById: admin.id, uploadedAt: new Date() },
    });

    if (previous) await deleteTutorialVideoFile(previous.url);

    await logAdminAction({
      actorId: admin.id,
      action: "tutorial.videoReplaced",
      targetType: "TutorialVideo",
      targetId: TUTORIAL_VIDEO_ID,
      detail: file.name,
    });

    return { ok: true as const, intent };
  }

  if (intent === "removeVideo") {
    const existing = await db.tutorialVideo.findUnique({
      where: { id: TUTORIAL_VIDEO_ID },
      select: { url: true },
    });
    if (!existing) {
      return { ok: false as const, error: "adminTutorial.errorNothingToRemove" as TranslationKey };
    }

    await db.tutorialVideo.delete({ where: { id: TUTORIAL_VIDEO_ID } });
    await deleteTutorialVideoFile(existing.url);

    await logAdminAction({
      actorId: admin.id,
      action: "tutorial.videoRemoved",
      targetType: "TutorialVideo",
      targetId: TUTORIAL_VIDEO_ID,
    });

    return { ok: true as const, intent };
  }

  if (intent === "saveText") {
    const abstractEn = String(form.get("abstractEn") ?? "").trim();
    const abstractIt = String(form.get("abstractIt") ?? "").trim();
    const abstractDe = String(form.get("abstractDe") ?? "").trim();

    if (!abstractEn || !abstractIt || !abstractDe) {
      return { ok: false as const, error: "adminLanding.errorEmptyText" as TranslationKey };
    }

    await db.landingContent.upsert({
      where: { id: LANDING_CONTENT_ID },
      create: {
        id: LANDING_CONTENT_ID,
        abstractEn,
        abstractIt,
        abstractDe,
        updatedById: admin.id,
      },
      update: { abstractEn, abstractIt, abstractDe, updatedById: admin.id },
    });

    await logAdminAction({
      actorId: admin.id,
      action: "landing.textUpdated",
      targetType: "LandingContent",
      targetId: LANDING_CONTENT_ID,
      detail: abstractEn,
    });

    return { ok: true as const, intent };
  }

  return { ok: false as const, error: "adminTutorial.errorGeneric" as TranslationKey };
}

export default function AdminLanding({ loaderData }: Route.ComponentProps) {
  const { video, text } = loaderData;
  const t = useT();
  const formatDay = useFormatDay();
  const textFetcher = useFetcher<typeof action>();
  const videoFetcher = useFetcher<typeof action>();
  const removeFetcher = useFetcher<typeof action>();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoBusy = videoFetcher.state !== "idle";
  const [clientError, setClientError] = useState<TranslationKey | null>(null);

  function onFileChange() {
    const file = inputRef.current?.files?.[0];
    if (!file) return setClientError(null);
    if (file.type !== "video/mp4") {
      inputRef.current!.value = "";
      setClientError("adminTutorial.errorBadType");
      return;
    }
    if (file.size > MAX_TUTORIAL_VIDEO_BYTES) {
      inputRef.current!.value = "";
      setClientError("adminTutorial.errorTooBig");
      return;
    }
    setClientError(null);
  }

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("adminLanding.heading")} intro={t("adminLanding.intro")} />

        {/* -------------------------------------------------- testo */}
        <div className="mt-8">
          <p className="eyebrow">{t("adminLanding.textHeading")}</p>

          <textFetcher.Form method="post" className="mt-3 flex flex-col gap-4">
            <input type="hidden" name="intent" value="saveText" />
            {LANGUAGES.map((lang) => (
              <div key={lang}>
                <label htmlFor={`text-${lang}`} className="eyebrow">
                  {LANGUAGE_NAMES[lang]}
                </label>
                <textarea
                  id={`text-${lang}`}
                  name={FIELD[lang]}
                  defaultValue={text[lang]}
                  rows={3}
                  className="field-area mt-1.5 block w-full"
                  required
                />
              </div>
            ))}

            <Button
              type="submit"
              variant="primary"
              busy={textFetcher.state !== "idle"}
              className="self-start"
            >
              {t("adminLanding.saveText")}
            </Button>

            {textFetcher.state === "idle" && textFetcher.data?.ok && (
              <span className="text-sm text-muted">{t("adminLanding.textSaved")}</span>
            )}
            {textFetcher.data && !textFetcher.data.ok && (
              <p role="alert" className="text-sm text-out">
                {t(textFetcher.data.error)}
              </p>
            )}
          </textFetcher.Form>
        </div>

        {/* -------------------------------------------------- video */}
        <div className="mt-12 border-t border-rule pt-8">
          <p className="eyebrow">{t("adminTutorial.heading")}</p>
          <p className="mt-1 text-sm text-muted">{t("adminTutorial.intro")}</p>

          {video && (
            <div className="mt-4">
              <p className="eyebrow">{t("adminTutorial.current")}</p>
              <video
                controls
                src="/uploads/tutorial"
                className="mt-2 w-full rounded-sm border border-rule"
              />
              <p className="mt-2 text-sm text-muted">
                {t("adminTutorial.uploadedBy", { date: formatDay(video.uploadedAt) })}{" "}
                <PersonName person={video.uploadedBy} />
              </p>

              <removeFetcher.Form
                method="post"
                className="mt-3"
                onSubmit={confirm.ask({
                  title: t("adminTutorial.confirmRemove"),
                  confirmLabel: t("adminTutorial.remove"),
                  tone: "danger",
                })}
              >
                <input type="hidden" name="intent" value="removeVideo" />
                <button
                  type="submit"
                  disabled={removeFetcher.state !== "idle"}
                  className={buttonClass("danger", "sm")}
                >
                  {t("adminTutorial.remove")}
                </button>
              </removeFetcher.Form>
              {removeFetcher.data && !removeFetcher.data.ok && (
                <p role="alert" className="mt-2 text-sm text-out">
                  {t(removeFetcher.data.error)}
                </p>
              )}
            </div>
          )}

          <videoFetcher.Form method="post" encType="multipart/form-data" className="mt-6">
            <input type="hidden" name="intent" value="saveVideo" />
            <label htmlFor="video" className="eyebrow">
              {video ? t("adminTutorial.replace") : t("adminTutorial.upload")}
            </label>
            <input
              ref={inputRef}
              id="video"
              name="video"
              type="file"
              accept={ACCEPTED_VIDEO_ACCEPT}
              onChange={onFileChange}
              className="field mt-1.5 block w-full"
              required
            />
            <p className="mt-1.5 text-sm text-muted">{t("adminTutorial.limits")}</p>

            <Button
              type="submit"
              variant="primary"
              busy={videoBusy}
              disabled={Boolean(clientError)}
              className="mt-4"
            >
              {video ? t("adminTutorial.replace") : t("adminTutorial.upload")}
            </Button>

            {clientError && (
              <p role="alert" className="mt-2 text-sm text-out">
                {t(clientError)}
              </p>
            )}
            {!clientError && videoFetcher.data && !videoFetcher.data.ok && (
              <p role="alert" className="mt-2 text-sm text-out">
                {t(videoFetcher.data.error)}
              </p>
            )}
          </videoFetcher.Form>
        </div>

        {confirm.dialog}
      </PageShell>
    </main>
  );
}
