import { useCallback, useState } from "react";
import { Dialog } from "~/components/dialog";
import { db } from "~/lib/db.server";
import { TUTORIAL_VIDEO_ID } from "~/lib/uploads.server";
import { LANDING_CONTENT_ID } from "~/lib/landing-content.server";
import { getUser } from "~/lib/session.server";
import { getLang } from "~/i18n/lang.server";
import { translate } from "~/i18n/dictionaries";
import type { Route } from "./+types/landing";
import { ButtonLink } from "~/components/button";
import { Logo } from "~/components/logo";
import { pageTitle, tagline } from "~/i18n/meta";
import { useT } from "~/i18n/use-t";
import "~/styles/landing.css";

export function meta({ matches }: Route.MetaArgs) {
  return [
    { title: pageTitle(matches, "app.name") },
    { name: "description", content: tagline(matches) },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  const lang = getLang(request, user?.language);

  const [video, content] = await Promise.all([
    db.tutorialVideo.findUnique({ where: { id: TUTORIAL_VIDEO_ID }, select: { id: true } }),
    db.landingContent.findUnique({
      where: { id: LANDING_CONTENT_ID },
      select: { abstractEn: true, abstractIt: true, abstractDe: true },
    }),
  ]);

  const abstract = content
    ? { en: content.abstractEn, it: content.abstractIt, de: content.abstractDe }[lang]
    : translate(lang, "landing.intro");

  return { hasTutorialVideo: Boolean(video), abstract };
}

const steps = ["discover", "request", "return"] as const;
const questions = ["account", "confirmation", "collection", "storage"] as const;

export default function Landing({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const onCloseTutorial = useCallback(() => setTutorialOpen(false), []);
  return (
    <main className="fabula-landing">
      <section className="fabula-hero" aria-labelledby="fabula-title">
        <div className="fabula-inner">
          <h1 id="fabula-title"><span className="sr-only">Fabula</span><span aria-hidden="true"><Logo className="fabula-wordmark" tone="current" /></span></h1>
          <p className="fabula-promise">{t("landing.promise")}</p>
          <p className="fabula-intro">{loaderData.abstract}</p>
          <div className="fabula-actions">
            <ButtonLink to="/catalogue" variant="primary">{t("landing.goToCatalogue")}</ButtonLink>
            <a href="#how-it-works" className="fabula-text-link">{t("landing.howLink")}</a>
            {loaderData.hasTutorialVideo && (
              <button type="button" className="fabula-text-link cursor-pointer" onClick={() => { setVideoError(false); setTutorialOpen(true); }}>
                {t("landing.tutorial")}
              </button>
            )}
          </div>
          <p className="fabula-hero-note">{t("landing.openCatalogue")}</p>
        </div>
      </section>

      <div className="fabula-hero-spacer" aria-hidden="true" />

      <section id="how-it-works" className="fabula-section" aria-labelledby="how-title">
        <div className="fabula-inner">
          <div className="fabula-section-heading">
            <p className="fabula-kicker">01 / {t("landing.howLabel")}</p>
            <h2 id="how-title">{t("landing.howTitle")}</h2>
          </div>
          <ol className="fabula-steps">
            {steps.map((step, index) => (
              <li key={step}>
                <span className="fabula-step-number" aria-hidden="true">0{index + 1}</span>
                <h3>{t(`landing.${step}.title`)}</h3>
                <p>{t(`landing.${step}.body`)}</p>
              </li>
            ))}
          </ol>
          <div className="fabula-inline-note">
            <p>{t("landing.approvalNote")}</p>
            <ButtonLink to="/calendar" variant="secondary">{t("landing.viewCalendar")}</ButtonLink>
          </div>
        </div>
      </section>

      <section className="fabula-section fabula-network" aria-labelledby="network-title">
        <div className="fabula-inner">
          <div className="fabula-section-heading">
            <p className="fabula-kicker">02 / {t("landing.networkLabel")}</p>
            <h2 id="network-title">{t("landing.networkTitle")}</h2>
            <p>{t("landing.networkBody")}</p>
          </div>
          <ul className="fabula-partners" aria-label={t("landing.networkLabel")}>
            <li><img src="/icons/loghi/provincia-autonoma-bz.svg" alt={t("landing.partner.province")} loading="lazy" width="835" height="218" /></li>
            <li><img src="/icons/loghi/citta-di-bolzano.svg" alt={t("landing.partner.city")} loading="lazy" width="640" height="278" /></li>
            <li><img src="/icons/loghi/sparkasse.svg" alt="Stiftung Fondazione Sparkasse" loading="lazy" width="693" height="283" /></li>
            <li><img src="/icons/loghi/inside.svg" alt="Inside" loading="lazy" width="621" height="390" /></li>
            <li><img src="/icons/loghi/young-inside.svg" alt="Young Inside" loading="lazy" width="525" height="226" /></li>
          </ul>
        </div>
      </section>

      <section className="fabula-section fabula-faq" aria-labelledby="faq-title">
        <div className="fabula-inner fabula-faq-layout">
          <div className="fabula-section-heading">
            <p className="fabula-kicker">03 / {t("landing.faqLabel")}</p>
            <h2 id="faq-title">{t("landing.faqTitle")}</h2>
          </div>
          <div>
            {questions.map((question) => (
              <details key={question}>
                <summary>{t(`landing.faq.${question}.question`)}</summary>
                <p>{t(`landing.faq.${question}.answer`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {tutorialOpen && (
        <Dialog onClose={onCloseTutorial} labelledBy="tutorial-title" panelClassName="max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <h2 id="tutorial-title" className="font-serif text-lg font-semibold">
              {t("landing.tutorial")}
            </h2>
            <button
              type="button"
              onClick={onCloseTutorial}
              aria-label={t("landing.closeTutorial")}
              className="rounded-sm px-2 py-1 text-lg text-muted hover:text-ink"
            >
              ×
            </button>
          </div>

          <div className="mt-4 aspect-video w-full overflow-hidden rounded-sm bg-black">
            {videoError ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
                {t("landing.noTutorialVideo")}
              </div>
            ) : (
              <video
                controls
                autoPlay
                src="/uploads/tutorial"
                onError={() => setVideoError(true)}
                className="h-full w-full"
              />
            )}
          </div>
        </Dialog>
      )}
    </main>
  );
}
