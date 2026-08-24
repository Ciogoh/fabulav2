/**
 * Lo scanner: inquadra l'adesivo di un oggetto e ti porta alla sua consegna.
 *
 * Tre cose non ovvie, tutte imparate dal modo in cui i browser trattano una
 * fotocamera:
 *
 * 1. **La fotocamera parte da una pressione, non da sola.** Su iOS
 *    `getUserMedia` chiamato durante il caricamento della pagina viene
 *    rifiutato senza nemmeno chiedere il permesso: deve nascere da un gesto
 *    dell'utente. Da qui il pulsante «Avvia», che non è una cortesia ma
 *    l'unico modo perché funzioni.
 * 2. **`qr-scanner` e non `BarcodeDetector`.** Quest'ultimo è nel browser e
 *    non costerebbe niente, ma su iOS Safari non esiste affatto — e metà
 *    dell'associazione gira con un iPhone. La libreria usa `BarcodeDetector`
 *    dove c'è e un decoder proprio dove non c'è.
 * 3. **Serve HTTPS.** `getUserMedia` esiste solo in un contesto sicuro:
 *    `localhost` va bene, l'indirizzo IP del computer sulla rete di casa no.
 *    Per provarlo dal telefono in sviluppo si passa dal tunnel Cloudflare che
 *    il progetto usa già, non da `192.168.x.x`.
 *
 * **Il testo letto dalla fotocamera non è fidato.** Un adesivo è un oggetto
 * fisico che chiunque passi in magazzino può sostituire con uno stampato in
 * casa, e un QR può contenere qualunque indirizzo. Vale la stessa regola già
 * scritta per i redirect che arrivano dall'utente: si accetta solo un
 * indirizzo di *questa* applicazione e con il percorso che ci aspettiamo,
 * tutto il resto viene ignorato senza nemmeno mostrarlo. Senza questo
 * controllo, un adesivo falso su un treppiede porterebbe chi lo scansiona su
 * un sito qualsiasi — con l'aria di esserci arrivato da dentro Fabula.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/admin.scan";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "scan.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

/**
 * Il percorso di consegna estratto da un QR, oppure `null` se quel testo non
 * è uno dei nostri.
 *
 * Il confronto è sull'origine di *questa* pagina e non su `APP_URL`: un QR
 * stampato quando il dominio era un altro non deve funzionare, e soprattutto
 * così il controllo non dipende da una variabile d'ambiente che nel browser
 * non c'è. L'identificativo deve essere un cuid plausibile e nient'altro —
 * niente barre, niente punti, quindi niente modo di risalire da lì a un
 * percorso diverso.
 */
export function handoverPathFrom(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;

  const match = /^\/admin\/handover\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
  return match ? `/admin/handover/${match[1]}` : null;
}

type Status = "idle" | "starting" | "scanning" | "denied" | "failed";

export default function Scan() {
  const t = useT();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  /* Il tipo vero è `QrScanner`, ma la libreria si carica solo nel browser e
     importarla per il tipo la tirerebbe dentro al pacchetto del server. */
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [rejected, setRejected] = useState(false);

  // Spegnere la fotocamera quando si lascia la pagina non è un dettaglio: se
  // resta accesa, sul telefono resta acceso anche il puntino verde e la
  // batteria se ne va senza che nessuno stia guardando niente.
  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  async function start() {
    if (!videoRef.current) return;
    setStatus("starting");
    setRejected(false);

    try {
      // Import dinamico: `qr-scanner` tocca `document` appena viene caricata,
      // e questa pagina viene disegnata anche sul server.
      const { default: QrScanner } = await import("qr-scanner");

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const path = handoverPathFrom(result.data, window.location.origin);
          if (!path) {
            // Un QR che non è dei nostri: si dice e si continua a inquadrare,
            // senza fermare la fotocamera. Fermarsi obbligherebbe a ripremere
            // «Avvia» ogni volta che entra nell'inquadratura il codice a
            // barre di una scatola.
            setRejected(true);
            return;
          }

          scanner.stop();
          navigate(path);
        },
        {
          // La fotocamera di dietro, quella con cui si inquadra qualcosa che
          // non sei tu.
          preferredCamera: "environment",
          highlightScanRegion: true,
          maxScansPerSecond: 5,
        }
      );

      scannerRef.current = scanner;
      await scanner.start();
      setStatus("scanning");
    } catch (error) {
      // Il permesso negato è il caso di gran lunga più comune, e ha una via
      // d'uscita diversa dagli altri guasti: non «riprova», ma «vai nelle
      // impostazioni del browser».
      const denied =
        error instanceof Error &&
        (error.name === "NotAllowedError" || /permission|denied/i.test(error.message));
      setStatus(denied ? "denied" : "failed");
      console.error("Avvio della fotocamera fallito:", error);
    }
  }

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("scan.heading")}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">{t("scan.intro")}</p>

        <div className="mt-6 overflow-hidden rounded border border-rule bg-sunk">
          {/* `playsInline` o su iPhone il video parte a schermo intero, e chi
              scansiona perde di vista la pagina sotto. `muted` perché senza,
              la riproduzione automatica viene bloccata. */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`aspect-[4/3] w-full object-cover ${
              status === "scanning" ? "" : "hidden"
            }`}
          />

          {status !== "scanning" && (
            <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm text-muted">
              {status === "denied"
                ? t("scan.denied")
                : status === "failed"
                  ? t("scan.failed")
                  : status === "starting"
                    ? t("scan.starting")
                    : t("scan.idle")}
            </div>
          )}
        </div>

        {status !== "scanning" && (
          <button
            type="button"
            onClick={() => void start()}
            disabled={status === "starting"}
            className={buttonClass("primary", "md", "mt-4")}
          >
            {status === "idle" ? t("scan.start") : t("scan.retry")}
          </button>
        )}

        {rejected && (
          <p role="alert" className="mt-4 rounded bg-out-bg px-3 py-2 text-sm text-out">
            {t("scan.notOurs")}
          </p>
        )}
      </PageShell>
    </main>
  );
}
