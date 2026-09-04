/**
 * Landing page di Fabula — la prima cosa che si vede aprendo il sito.
 *
 * Logo SVG a 3 livelli (ombra/sfaccettature/faccia) con un piccolo effetto di
 * pressione al click, zoom-in che porta a `/catalogue` o `/calendar`, e un
 * overlay opzionale col video del tutorial (visibile solo se un admin ne ha
 * caricato uno da `/admin/tutorial`).
 *
 * Colori e font vengono **solo** dai token di `app.css` (`--paper`, `--ink`,
 * `--brand`, `--accent`, `--font-sans`, `--font-mono`): nessun valore fisso,
 * così la pagina segue la pelle scelta (classic/riso) e il tema chiaro/scuro
 * come ogni altra pagina del sito, invece di restare congelata su un unico
 * aspetto.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/landing";
import { pageTitle, tagline } from "~/i18n/meta";
import { useT } from "~/i18n/use-t";
import { buttonClass } from "~/components/button";
import { Dialog } from "~/components/dialog";
import { db } from "~/lib/db.server";
import { TUTORIAL_VIDEO_ID } from "~/lib/uploads.server";
import { LANDING_CONTENT_ID } from "~/lib/landing-content.server";
import { getUser } from "~/lib/session.server";
import { getLang } from "~/i18n/lang.server";
import { translate } from "~/i18n/dictionaries";

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
    : translate(lang, "landing.abstract");

  return { hasTutorialVideo: Boolean(video), abstract };
}

export default function Landing({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"idle" | "pressed" | "zooming">("idle");
  const [navTarget, setNavTarget] = useState<"catalog" | "calendar">("catalog");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const onNavigate = (target: "catalog" | "calendar" = "catalog") => {
    if (phase !== "idle") return;
    setPhase("pressed");
    setNavTarget(target);

    const t1 = setTimeout(() => {
      setPhase("zooming");
    }, 190);

    const t2 = setTimeout(() => {
      navigate(target === "calendar" ? "/calendar" : "/catalogue");
    }, 190 + 900);

    timersRef.current.push(t1, t2);
  };

  const onNavigateCalendar = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onNavigate("calendar");
  };

  const onLandingClick = () => {
    onNavigate("catalog");
  };

  const onOpenTutorial = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (phase !== "idle") return;
    setVideoError(false);
    setTutorialOpen(true);
  };

  const onCloseTutorial = () => {
    setTutorialOpen(false);
  };

  const pressed = phase === "pressed";
  const zooming = phase === "zooming";

  const pressTransition = `transform ${
    pressed ? "190ms cubic-bezier(.4,0,.7,1)" : "480ms cubic-bezier(.22,1.4,.36,1)"
  }`;
  const pressTranslate = `translate(${pressed ? "7px,9px" : "0px,0px"})`;
  const zoomStyle = `scale(${zooming ? 60 : 1})`;
  const zoomOrigin = navTarget === "calendar" ? "188px 59px" : "283px 72px";
  const contentOpacity = zooming ? 0 : 1;
  const zoomDuration = zooming ? "900ms cubic-bezier(.6,0,.9,1)" : "0ms";

  return (
    <div
      style={{
        width: "100%",
        minHeight: "calc(100vh - 120px)",
        background: "var(--paper)",
        color: "var(--ink)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxSizing: "border-box",
        padding: "48px 24px",
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      <div
        onClick={onLandingClick}
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "40px",
            transform: zoomStyle,
            transformOrigin: zoomOrigin,
            opacity: contentOpacity,
            transition: `transform ${zoomDuration}, opacity ${zoomDuration}`,
          }}
        >
          {/* Logo SVG a 3 livelli. I tre `fill` sono token, non colori fissi:
              ombra → --ink, sfaccettature → --brand, faccia → --accent —
              così il logo segue la pelle attiva invece di restare fisso al
              magenta/ocra di un unico stile. */}
          <svg
            onClick={() => onNavigate("catalog")}
            viewBox="90 310 590 195"
            style={{
              display: "block",
              height: "151px",
              width: "509px",
              maxWidth: "100%",
              cursor: "pointer",
            }}
            aria-label="Fabula Logo"
          >
            <g fill="var(--ink)">
              <polygon points="119.2 428.9 119.2 470.1 182.3 470.1 182.3 428.9 224.7 428.9 224.7 408.1 182.3 408.1 182.3 387.4 245.1 387.4 245.1 365.4 142.7 365.4 142.7 386.2 160.8 386.2 160.8 449.3 141.2 449.3 141.2 428.9 119.2 428.9" />
              <path d="M307.5,387.4v103.4h-41.5v-20.6h20v-20.8h-41v20.8h-41.2v-20.8h20.8v-20.4h20.4v-41.6h62.5ZM287.3,407.1h-21.8v21.8h21.8v-21.8Z" />
              <path d="M329,344.5v21h20.9v21.9h42.2v41.6h20.1v61.8h-83.1v-103.4h-21.4v-42.9c0,.4,21.4,0,21.4,0ZM372.4,407.1h-22.6v22.6h22.6v-22.6ZM391.6,449.3h-41.8v20.8h41.8v-20.8Z" />
              <polygon points="392.1 365.4 392.1 387.4 433.8 387.4 433.8 470.1 495.7 470.1 495.7 386.8 517 386.8 517 365.4 476 365.4 476 449.3 454.3 449.3 454.3 365.4 392.1 365.4" />
              <polygon points="517 386.8 517 490.7 599.7 490.7 599.7 470.1 536.6 470.1 536.6 386.8 517 386.8" />
              <path d="M643.1,408.6h-21.8v-21.8h21.8v21.8ZM599.7,365.4v41.7h-19.5v21.8h-21.9v20.4h42.7v-20.4h42.1v20.4h20.9v20.8h20v-41.2h-20.8v-63.5h-63.6Z" />
            </g>

            <g
              style={{
                display: "block",
                transform: pressTranslate,
                transition: pressTransition,
              }}
            >
              <g fill="var(--brand)">
                <polygon points="112.8 419.5 112.8 460.7 175.9 460.7 175.9 419.5 218.2 419.5 218.2 398.7 175.9 398.7 175.9 378 238.6 378 238.6 356 136.2 356 136.2 376.8 154.3 376.8 154.3 439.9 134.7 439.9 134.7 419.5 112.8 419.5" />
                <path d="M301.1,378v103.4h-41.5v-20.6h20v-20.8h-41v20.8h-41.2v-20.8h20.8v-20.4h20.4v-41.6h62.5ZM280.8,397.7h-21.8v21.8h21.8v-21.8Z" />
                <path d="M322.5,335.1v21h20.9v21.9h42.2v41.6h20.1v61.8h-83.1v-103.4h-21.4v-42.9c0,.4,21.4,0,21.4,0ZM366,397.7h-22.6v22.6h22.6v-22.6ZM385.2,439.9h-41.8v20.8h41.8v-20.8Z" />
                <polygon points="385.6 356 385.6 378 427.4 378 427.4 460.7 489.2 460.7 489.2 377.4 510.5 377.4 510.5 356 469.6 356 469.6 439.9 447.8 439.9 447.8 356 385.6 356" />
                <polygon points="510.5 377.4 510.5 481.3 593.2 481.3 593.2 460.7 530.1 460.7 530.1 377.4 510.5 377.4" />
                <path d="M636.6,399.1h-21.8v-21.8h21.8v21.8ZM593.2,356v41.7h-19.5v21.8h-21.9v20.4h42.7v-20.4h42.1v20.4h20.9v20.8h20v-41.2h-20.8v-63.5h-63.6Z" />
                <polyline points="225.9 359.1 238.6 356 234 350" />
                <polygon points="136.2 376.8 131.6 370.8 136.2 370.8 136.2 376.8" />
                <polygon points="213.6 392.7 218.2 398.7 213 398.7 213.6 392.7" />
                <polygon points="130.1 413.5 134.7 419.5 129.4 419.5 130.1 413.5" />
                <polygon points="108.2 454.7 112.8 460.7 112.8 454.7 108.2 454.7" />
                <polygon points="192.8 454.7 197.4 460.7 197.4 454.7 192.8 454.7" />
                <rect x="296.5" y="371.9" width="4.6" height="6" />
                <polygon points="317.9 329 322.5 335.1 317.9 335.1 317.9 329" />
                <polygon points="338.8 350 343.4 356 338.8 356 338.8 350" />
                <rect x="381" y="371.9" width="4.6" height="6" />
                <polyline points="443.2 350 447.8 356 442.5 356 443.2 350" />
                <polyline points="401 413.5 405.6 419.5 401 419.5 401 413.5" />
                <polyline points="505.9 350 510.5 356 505.9 356 505.9 350" />
                <polyline points="525.5 371.3 530.1 377.4 524.5 377.4 525.5 371.3" />
                <polyline points="547.2 433.8 551.8 439.9 551.8 432.6 547.2 433.8" />
                <polyline points="652.2 350 656.8 356 651.5 356 652.2 350" />
                <polyline points="673 413.5 677.6 419.5 672.3 419.5 673 413.5" />
                <polyline points="632 433.8 636.6 439.9 636.6 432.4 632 433.8" />
                <polyline points="652.9 454.7 657.5 460.7 657.5 454.7 652.9 454.7" />
                <polyline points="588.6 454.7 593.2 460.7 587.8 460.7 588.6 454.7" />
                <polyline points="505.9 475.3 510.5 481.3 510.5 473.3 505.9 475.3" />
                <polyline points="255 475.3 259.6 481.3 259.6 473.2 255 475.3" />
                <polyline points="317.9 475.3 322.5 481.3 322.5 473.2 317.9 475.3" />
                <polyline points="422.8 454.7 427.4 460.7 427.4 451.9 422.8 454.7" />
              </g>

              <g fill="var(--accent)">
                <polygon points="108.2 413.5 108.2 454.7 171.3 454.7 171.3 413.5 213.6 413.5 213.6 392.7 171.3 392.7 171.3 371.9 234 371.9 234 350 131.6 350 131.6 370.8 149.7 370.8 149.7 433.9 130.1 433.9 130.1 413.5 108.2 413.5" />
                <path d="M296.5,371.9v103.4h-41.5v-20.6h20v-20.8h-41v20.8h-41.2v-20.8h20.8v-20.4h20.4v-41.6h62.5ZM276.2,391.7h-21.8v21.8h21.8v-21.8Z" />
                <path d="M317.9,329v21h20.9v21.9h42.2v41.6h20.1v61.8h-83.1v-103.4h-21.4v-42.9c0,.4,21.4,0,21.4,0ZM361.4,391.7h-22.6v22.6h22.6v-22.6ZM380.6,433.8h-41.8v20.8h41.8v-20.8Z" />
                <polygon points="381 350 381 371.9 422.8 371.9 422.8 454.7 484.6 454.7 484.6 371.3 505.9 371.3 505.9 350 465 350 465 433.8 443.2 433.8 443.2 350 381 350" />
                <polygon points="505.9 371.3 505.9 475.3 588.6 475.3 588.6 454.7 525.5 454.7 525.5 371.3 505.9 371.3" />
                <path d="M632,393.1h-21.8v-21.8h21.8v21.8ZM588.6,350v41.7h-19.5v21.8h-21.9v20.4h42.7v-20.4h42.1v20.4h20.9v20.8h20v-41.2h-20.8v-63.5h-63.6Z" />
              </g>
            </g>
          </svg>

          <p
            style={{
              margin: 0,
              maxWidth: "620px",
              fontFamily: "var(--font-mono)",
              fontSize: "15px",
              lineHeight: 1.75,
              color: "var(--ink)",
            }}
          >
            {loaderData.abstract}
          </p>

          {/* CTA: colore, font e stato disabilitato vengono da
              `buttonClass("primary","md")`, come ogni altro pulsante
              primario del sito — sotto la pelle Riso applica già mono,
              maiuscolo e spaziatura da sola (vedi `--btn-*` in `app.css`).
              L'unica aggiunta è l'ombra/traslazione al click: un'eccezione
              dichiarata, non una settima variante — qui il pulsante non sta
              in un modulo, è il gesto d'ingresso di tutta l'app. */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--ink)",
                transform: "translate(11px,15px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--brand)",
                transform: pressTranslate,
                transition: pressTransition,
              }}
            />
            <button
              type="button"
              onClick={() => onNavigate("catalog")}
              className={buttonClass("primary", "md")}
              style={{
                position: "relative",
                minHeight: "52px",
                padding: "0 32px",
                fontSize: "17px",
                transform: pressTranslate,
                transition: pressTransition,
              }}
            >
              {t("landing.cta")}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "28px",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              color: "var(--ink)",
            }}
          >
            {loaderData.hasTutorialVideo && (
              <LinkButton onClick={onOpenTutorial}>{t("landing.tutorial")}</LinkButton>
            )}
            <LinkButton onClick={onNavigateCalendar}>{t("landing.calendar")}</LinkButton>
          </div>
        </div>
      </div>

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
    </div>
  );
}

/** Un `<button>` vero, stilizzato come i due collegamenti sottolineati sotto
 * al CTA — a differenza di uno `<span role="button">` riceve Invio/Spazio
 * gratis, senza bisogno di un `onKeyDown` scritto a mano. */
function LinkButton({
  onClick,
  children,
}: {
  onClick: (e?: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
        textDecoration: "underline",
        cursor: "pointer",
        transition: "opacity 150ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {children}
    </button>
  );
}
