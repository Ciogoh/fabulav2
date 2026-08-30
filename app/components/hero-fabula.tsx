/**
 * Hero Landing Page — Schermata 2a
 *
 * Include:
 * 1. Logo Fabula 3D con ombra nera: premibile con offset obliquo 11px/15px e
 *    zoom interattivo nell'occhio della lettera 'B'.
 * 2. Lettera 'A' finale staccabile e animata in stop-motion (4 frame di camminata,
 *    corpo magenta con ombra 3D, occhio traforato, due gambe animate) che insegue
 *    il puntatore del mouse nell'area landing.
 * 3. Sottotitolo in Departure Mono e pulsante tattile 3D "Vai al catalogo".
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "~/i18n/use-t";

export function HeroFabula({
  onScrollToCatalogue,
}: {
  onScrollToCatalogue?: () => void;
}) {
  const t = useT();
  const heroRef = useRef<HTMLElement>(null);
  const [isLogoPressed, setIsLogoPressed] = useState(false);
  const [isBtnPressed, setIsBtnPressed] = useState(false);
  const [isZoomingB, setIsZoomingB] = useState(false);

  // --- Walking 'A' Stop-Motion Character State ---
  const [aPos, setAPos] = useState({ x: 0, y: 0, visible: false });
  const [walkFrame, setWalkFrame] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [isWalking, setIsWalking] = useState(false);

  // Target coordinates for physics tracking
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const lastStepTime = useRef(0);
  const animFrameId = useRef<number | null>(null);

  // Initialize and track mouse in hero
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      targetPos.current = { x: relX, y: relY };

      setAPos((prev) => {
        if (!prev.visible) {
          currentPos.current = { x: relX, y: relY + 30 };
          return { x: relX, y: relY + 30, visible: true };
        }
        return prev;
      });
    };

    const handleMouseLeave = () => {
      // Optional: reset target towards center or keep position
    };

    hero.addEventListener("mousemove", handleMouseMove);
    hero.addEventListener("mouseleave", handleMouseLeave);

    // Stop-motion physics loop
    const updatePhysics = (timestamp: number) => {
      const dx = targetPos.current.x - currentPos.current.x;
      const dy = targetPos.current.y - currentPos.current.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 12) {
        setIsWalking(true);
        // Ease towards target
        currentPos.current.x += dx * 0.08;
        currentPos.current.y += dy * 0.08;

        if (dx < -3) setFacingLeft(true);
        else if (dx > 3) setFacingLeft(false);

        // 4-frame stop-motion cycle every 110ms (approx 9 fps)
        if (timestamp - lastStepTime.current > 110) {
          setWalkFrame((f) => (f + 1) % 4);
          lastStepTime.current = timestamp;
        }

        setAPos({
          x: currentPos.current.x,
          y: currentPos.current.y,
          visible: true,
        });
      } else {
        setIsWalking(false);
      }

      animFrameId.current = requestAnimationFrame(updatePhysics);
    };

    animFrameId.current = requestAnimationFrame(updatePhysics);

    return () => {
      hero.removeEventListener("mousemove", handleMouseMove);
      hero.removeEventListener("mouseleave", handleMouseLeave);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  const handleLogoClick = () => {
    setIsLogoPressed(true);
    setTimeout(() => {
      setIsLogoPressed(false);
      setIsZoomingB(true);
      setTimeout(() => {
        setIsZoomingB(false);
        if (onScrollToCatalogue) {
          onScrollToCatalogue();
        } else {
          document
            .getElementById("catalogo")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      }, 700);
    }, 150);
  };

  const handleBtnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsBtnPressed(true);
    setTimeout(() => {
      setIsBtnPressed(false);
      if (onScrollToCatalogue) {
        onScrollToCatalogue();
      } else {
        document
          .getElementById("catalogo")
          ?.scrollIntoView({ behavior: "smooth" });
      }
    }, 120);
  };

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden bg-[#FFF6E8] border-b-2 border-[#2B0016] py-14 sm:py-20 md:py-24 text-center select-none"
    >
      <div
        className={`mx-auto max-w-4xl px-6 transition-transform duration-700 ease-in-out ${
          isZoomingB ? "scale-[4.5] translate-y-24 opacity-0 pointer-events-none" : ""
        }`}
        style={{
          transformOrigin: "42% 45%", // Target the eye of letter 'B'
        }}
      >
        {/* --- 3D Logo Fabula --- */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Fabula - Premi per andare al catalogo"
          onClick={handleLogoClick}
          onMouseDown={() => setIsLogoPressed(true)}
          onMouseUp={() => setIsLogoPressed(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleLogoClick();
          }}
          className="group relative mx-auto inline-block cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-[#E00069]/40"
        >
          {/* Logo SVG containing 3D shadow, ocra sides, and magenta face */}
          <div
            className={`transition-transform duration-100 ease-out ${
              isLogoPressed ? "translate-x-[11px] translate-y-[11px]" : "translate-x-0 translate-y-0"
            }`}
          >
            <svg
              viewBox="100 320 600 190"
              xmlns="http://www.w3.org/2000/svg"
              className="h-28 w-auto sm:h-36 md:h-44 max-w-full drop-shadow-sm"
            >
              {/* Livello 4: Ombra Nera 3D */}
              <g
                id="shadow-layer"
                fill="#2B0016"
                className={`transition-opacity duration-100 ${
                  isLogoPressed ? "opacity-30" : "opacity-100"
                }`}
              >
                <polygon points="119.2 428.9 119.2 470.1 182.3 470.1 182.3 428.9 224.7 428.9 224.7 408.1 182.3 408.1 182.3 387.4 245.1 387.4 245.1 365.4 142.7 365.4 142.7 386.2 160.8 386.2 160.8 449.3 141.2 449.3 141.2 428.9 119.2 428.9" />
                <path d="M307.5,387.4v103.4h-41.5v-20.6h20v-20.8h-41v20.8h-41.2v-20.8h20.8v-20.4h20.4v-41.6h62.5ZM287.3,407.1h-21.8v21.8h21.8v-21.8Z" />
                <path d="M329,344.5v21h20.9v21.9h42.2v41.6h20.1v61.8h-83.1v-103.4h-21.4v-42.9c0,.4,21.4,0,21.4,0ZM372.4,407.1h-22.6v22.6h22.6v-22.6ZM391.6,449.3h-41.8v20.8h41.8v-20.8Z" />
                <polygon points="392.1 365.4 392.1 387.4 433.8 387.4 433.8 470.1 495.7 470.1 495.7 386.8 517 386.8 517 365.4 476 365.4 476 449.3 454.3 449.3 454.3 365.4 392.1 365.4" />
                <polygon points="517 386.8 517 490.7 599.7 490.7 599.7 470.1 536.6 470.1 536.6 386.8 517 386.8" />
                <path d="M643.1,408.6h-21.8v-21.8h21.8v21.8ZM599.7,365.4v41.7h-19.5v21.8h-21.9v20.4h42.7v-20.4h42.1v20.4h20.9v20.8h20v-41.2h-20.8v-63.5h-63.6Z" />
              </g>

              {/* Livello Ocra: Sfaccettature 3D */}
              <g id="ocra-layer" fill="#FFAC00">
                <polygon points="112.8 419.5 112.8 460.7 175.9 460.7 175.9 419.5 218.2 419.5 218.2 398.7 175.9 398.7 175.9 378 238.6 378 238.6 356 136.2 356 136.2 376.8 154.3 376.8 154.3 439.9 134.7 439.9 134.7 419.5 112.8 419.5" />
                <path d="M301.1,378v103.4h-41.5v-20.6h20v-20.8h-41v20.8h-41.2v-20.8h20.8v-20.4h20.4v-41.6h62.5ZM280.8,397.7h-21.8v21.8h21.8v-21.8Z" />
                <path d="M322.5,335.1v21h20.9v21.9h42.2v41.6h20.1v61.8h-83.1v-103.4h-21.4v-42.9c0,.4,21.4,0,21.4,0ZM366,397.7h-22.6v22.6h22.6v-22.6ZM385.2,439.9h-41.8v20.8h41.8v-20.8Z" />
                <polygon points="385.6 356 385.6 378 427.4 378 427.4 460.7 489.2 460.7 489.2 377.4 510.5 377.4 510.5 356 469.6 356 469.6 439.9 447.8 439.9 447.8 356 385.6 356" />
                <polygon points="510.5 377.4 510.5 481.3 593.2 481.3 593.2 460.7 530.1 460.7 530.1 377.4 510.5 377.4" />
                <path d="M636.6,399.1h-21.8v-21.8h21.8v21.8ZM593.2,356v41.7h-19.5v21.8h-21.9v20.4h42.7v-20.4h42.1v20.4h20.9v20.8h20v-41.2h-20.8v-63.5h-63.6Z" />
                {/* Dettagli sfaccettature */}
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

              {/* Livello Magenta: Faccia frontale */}
              <g id="magenta-layer" fill="#E00069">
                <polygon points="108.2 413.5 108.2 454.7 171.3 454.7 171.3 413.5 213.6 413.5 213.6 392.7 171.3 392.7 171.3 371.9 234 371.9 234 350 131.6 350 131.6 370.8 149.7 370.8 149.7 433.9 130.1 433.9 130.1 413.5 108.2 413.5" />
                <path d="M296.5,371.9v103.4h-41.5v-20.6h20v-20.8h-41v20.8h-41.2v-20.8h20.8v-20.4h20.4v-41.6h62.5ZM276.2,391.7h-21.8v21.8h21.8v-21.8Z" />
                <path d="M317.9,329v21h20.9v21.9h42.2v41.6h20.1v61.8h-83.1v-103.4h-21.4v-42.9c0,.4,21.4,0,21.4,0ZM361.4,391.7h-22.6v22.6h22.6v-22.6ZM380.6,433.8h-41.8v20.8h41.8v-20.8Z" />
                <polygon points="381 350 381 371.9 422.8 371.9 422.8 454.7 484.6 454.7 484.6 371.3 505.9 371.3 505.9 350 465 350 465 433.8 443.2 433.8 443.2 350 381 350" />
                <polygon points="505.9 371.3 505.9 475.3 588.6 475.3 588.6 454.7 525.5 454.7 525.5 371.3 505.9 371.3" />
                <path d="M632,393.1h-21.8v-21.8h21.8v21.8ZM588.6,350v41.7h-19.5v21.8h-21.9v20.4h42.7v-20.4h42.1v20.4h20.9v20.8h20v-41.2h-20.8v-63.5h-63.6Z" />
              </g>
            </svg>
          </div>
        </div>

        {/* --- Subtitle in Departure Mono --- */}
        <p className="mx-auto mt-6 max-w-xl font-mono text-sm sm:text-base leading-relaxed text-[#2B0016]/80 font-normal">
          {t("landing.subtitle")}
        </p>

        {/* --- 3D Tactile CTA Button --- */}
        <div className="mt-8">
          <a
            href="#catalogo"
            onClick={handleBtnClick}
            onMouseDown={() => setIsBtnPressed(true)}
            onMouseUp={() => setIsBtnPressed(false)}
            data-pressed={isBtnPressed}
            className="btn-3d-hero inline-flex items-center gap-2 select-none"
          >
            <span>{t("landing.goToCatalogue")}</span>
            <span aria-hidden="true" className="text-lg leading-none">
              ↓
            </span>
          </a>
        </div>
      </div>

      {/* --- Walking 'A' Interactive Stop-Motion Character --- */}
      {aPos.visible && (
        <div
          className="pointer-events-none absolute z-10 transition-opacity duration-300"
          style={{
            transform: `translate3d(${aPos.x - 30}px, ${aPos.y - 45}px, 0) ${
              facingLeft ? "scaleX(-1)" : "scaleX(1)"
            }`,
          }}
        >
          <div className="relative">
            {/* Letter 'A' Character Body (with eye hole and 3D offset) */}
            <svg
              width="50"
              height="50"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md"
            >
              {/* Black 3D Shadow */}
              <path
                d="M62 25V65H42V55H52V45H32V55H12V45H22V35H32V15H62ZM52 35H42V45H52V35Z"
                fill="#2B0016"
                transform="translate(6, 6)"
              />
              {/* Orange 3D Bevel Facet */}
              <path
                d="M62 25V65H42V55H52V45H32V55H12V45H22V35H32V15H62ZM52 35H42V45H52V35Z"
                fill="#FFAC00"
                transform="translate(3, 3)"
              />
              {/* Magenta Letter Body */}
              <path
                d="M62 25V65H42V55H52V45H32V55H12V45H22V35H32V15H62ZM52 35H42V45H52V35Z"
                fill="#E00069"
              />
              {/* Hole punch eye with pupil */}
              <rect x="42" y="35" width="10" height="10" fill="#FFF6E8" />
              <rect x="45" y="38" width="4" height="4" fill="#2B0016" />
            </svg>

            {/* 4-Frame Stop-Motion Walking Legs */}
            <svg
              width="50"
              height="20"
              viewBox="0 0 50 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-mt-3 ml-2"
            >
              {isWalking ? (
                <>
                  {walkFrame === 0 && (
                    <g fill="#2B0016">
                      {/* Frame 0: Left forward, right backward */}
                      <rect x="14" y="0" width="4" height="12" />
                      <rect x="10" y="10" width="8" height="4" />
                      <rect x="28" y="0" width="4" height="10" />
                      <rect x="30" y="8" width="6" height="4" />
                    </g>
                  )}
                  {walkFrame === 1 && (
                    <g fill="#2B0016">
                      {/* Frame 1: Mid step pass */}
                      <rect x="18" y="0" width="4" height="14" />
                      <rect x="18" y="12" width="6" height="4" />
                      <rect x="24" y="0" width="4" height="8" />
                      <rect x="24" y="6" width="6" height="4" />
                    </g>
                  )}
                  {walkFrame === 2 && (
                    <g fill="#2B0016">
                      {/* Frame 2: Right forward, left backward */}
                      <rect x="14" y="0" width="4" height="10" />
                      <rect x="12" y="8" width="6" height="4" />
                      <rect x="28" y="0" width="4" height="12" />
                      <rect x="28" y="10" width="8" height="4" />
                    </g>
                  )}
                  {walkFrame === 3 && (
                    <g fill="#2B0016">
                      {/* Frame 3: Mid step pass return */}
                      <rect x="16" y="0" width="4" height="8" />
                      <rect x="16" y="6" width="6" height="4" />
                      <rect x="26" y="0" width="4" height="14" />
                      <rect x="26" y="12" width="6" height="4" />
                    </g>
                  )}
                </>
              ) : (
                /* Standing Idle Frame */
                <g fill="#2B0016">
                  <rect x="16" y="0" width="4" height="12" />
                  <rect x="16" y="10" width="6" height="4" />
                  <rect x="26" y="0" width="4" height="12" />
                  <rect x="26" y="10" width="6" height="4" />
                </g>
              )}
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
