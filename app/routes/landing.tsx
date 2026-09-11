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

const steps = ["discover", "request", "return"] as const;
const features = ["availability", "messages", "reminders", "management"] as const;
const questions = ["account", "confirmation", "collection", "storage"] as const;

function FeatureStar() {
  return (
    <svg className="fabula-feature-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="m12 2 2.9 6.2 6.8.9-5 4.7 1.3 6.8-6-3.3-6 3.3 1.3-6.8-5-4.7 6.8-.9Z" />
    </svg>
  );
}

export default function Landing() {
  const t = useT();
  return (
    <main className="fabula-landing">
      <section className="fabula-hero" aria-labelledby="fabula-title">
        <div className="fabula-inner">
          <p className="fabula-kicker">{t("landing.eyebrow")}</p>
          <h1 id="fabula-title"><span className="sr-only">Fabula</span><span aria-hidden="true"><Logo className="fabula-wordmark" tone="current" /></span></h1>
          <p className="fabula-promise">{t("landing.promise")}</p>
          <p className="fabula-intro">{t("landing.intro")}</p>
          <div className="fabula-actions">
            <ButtonLink to="/catalogue" variant="primary">{t("landing.goToCatalogue")}</ButtonLink>
            <a href="#how-it-works" className="fabula-text-link">{t("landing.howLink")}</a>
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

      <section className="fabula-section fabula-platform" aria-labelledby="platform-title">
        <div className="fabula-inner">
          <div className="fabula-section-heading">
            <p className="fabula-kicker">02 / {t("landing.platformLabel")}</p>
            <h2 id="platform-title">{t("landing.platformTitle")}</h2>
            <p>{t("landing.platformIntro")}</p>
          </div>
          <div className="fabula-features">
            {features.map((feature) => (
              <article key={feature}>
                <FeatureStar />
                <div><h3>{t(`landing.${feature}.title`)}</h3><p>{t(`landing.${feature}.body`)}</p></div>
              </article>
            ))}
          </div>
          <div className="fabula-trust">
            <h3>{t("landing.trustTitle")}</h3>
            <p>{t("landing.trustBody")}</p>
          </div>
        </div>
      </section>

      <section className="fabula-section fabula-network" aria-labelledby="network-title">
        <div className="fabula-inner">
          <div className="fabula-section-heading">
            <p className="fabula-kicker">03 / {t("landing.networkLabel")}</p>
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
            <p className="fabula-kicker">04 / {t("landing.faqLabel")}</p>
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

      <section className="fabula-closing" aria-labelledby="closing-title">
        <div className="fabula-inner">
          <h2 id="closing-title">{t("landing.closingTitle")}</h2>
          <p>{t("landing.closingBody")}</p>
          <ButtonLink to="/catalogue" variant="primary">{t("landing.goToCatalogue")}</ButtonLink>
        </div>
      </section>
    </main>
  );
}
