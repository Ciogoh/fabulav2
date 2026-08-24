/**
 * Lo scanner: inquadra l'adesivo di un oggetto e ti porta alla sua consegna.
 *
 * **Funziona col telefono in magazzino e con la webcam di un portatile.** Il
 * telefono è il caso per cui è nato, ma la webcam non è un ripiego di
 * cortesia: chi sta alla scrivania con un oggetto in mano deve poterlo
 * consegnare senza tirare fuori il telefono.
 *
 * Cinque cose non ovvie, tutte imparate dal modo in cui i browser trattano
 * una fotocamera:
 *
 * 1. **La fotocamera parte da una pressione, non da sola.** Su iOS
 *    `getUserMedia` chiamato durante il caricamento della pagina viene
 *    rifiutato senza nemmeno chiedere il permesso: deve nascere da un gesto
 *    dell'utente. Da qui il pulsante «Avvia», che non è una cortesia ma
 *    l'unico modo perché funzioni.
 * 2. **`preferredCamera: "environment"` da solo non basta su un portatile.**
 *    La libreria lo chiede come vincolo *esatto*, e un Mac senza fotocamera
 *    posteriore risponde `OverconstrainedError` — provato. Va a finire bene
 *    lo stesso perché `qr-scanner` riprova senza quel vincolo e si prende la
 *    webcam che c'è; resta la preferenza giusta per il telefono, dove la
 *    posteriore è quella con cui si inquadra qualcosa che non sei tu.
 * 3. **Chi ha più di una fotocamera deve poter scegliere.** Sul portatile è
 *    webcam interna contro webcam esterna, sul telefono è davanti contro
 *    dietro: in tutti e due i casi il ripiego del punto 2 può prendere quella
 *    sbagliata, e senza un modo di cambiarla non resta niente da fare.
 * 4. **`qr-scanner` e non `BarcodeDetector`.** Quest'ultimo è nel browser e
 *    non costerebbe niente, ma su iOS Safari non esiste affatto — e metà
 *    dell'associazione gira con un iPhone. La libreria usa `BarcodeDetector`
 *    dove c'è e un decoder proprio dove non c'è.
 * 5. **Serve HTTPS.** `getUserMedia` esiste solo in un contesto sicuro:
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
import { Select } from "~/components/select";
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

type Status =
  | "idle"
  | "starting"
  | "scanning"
  | "denied"
  | "noCamera"
  | "blockedByPolicy"
  | "failed";

type CameraChoice = { id: string; label: string };

/**
 * `document.featurePolicy` non sta nei tipi del DOM perché non è standard:
 * c'è su Chrome ed Edge, non su Firefox né Safari. Si dichiara qui il minimo
 * che ci serve — opzionale, così il controllo dell'esistenza resta
 * obbligatorio e non ci si può dimenticare che altrove non c'è.
 */
type DocumentWithFeaturePolicy = Document & {
  featurePolicy?: { allowsFeature(feature: string): boolean };
};

/**
 * Perché la fotocamera non è partita.
 *
 * Serve una domanda esplicita al browser perché **`qr-scanner` non lo dice**:
 * prova una lista di vincoli in sequenza, inghiotte l'errore di ognuno in un
 * `catch` vuoto e alla fine rilancia la stringa `"Camera not found."`. Il
 * permesso negato e l'assenza di una fotocamera arrivano quindi identici, e
 * sono i due casi con la via d'uscita più diversa: uno si risolve nelle
 * impostazioni del browser, l'altro non si risolve affatto.
 *
 * `navigator.permissions` non conosce `camera` su Firefox e su Safari: lì la
 * domanda fallisce, si ripiega sul messaggio generico, e va bene così — un
 * messaggio meno preciso è meglio di uno sbagliato.
 */
async function diagnoseCameraFailure(): Promise<Status> {
  /* **Prima di tutto: siamo noi a vietarcela?** `Permissions-Policy` con
     `camera=()` significa «nessuna origine, noi compresi», e in quel caso il
     browser non chiede il permesso e non lo chiederà mai — darglielo a mano
     nelle impostazioni non cambia niente, perché la decisione è già presa
     dall'intestazione. È successo davvero: `root.tsx` spegneva la fotocamera
     da quando esisteva, cioè da prima che ci fosse uno scanner.
     Va chiesto per primo perché `permissions.query` in quel caso risponde
     «denied» come per un rifiuto vero, e il consiglio da dare è l'opposto. */
  const doc = document as DocumentWithFeaturePolicy;
  if (doc.featurePolicy) {
    try {
      if (!doc.featurePolicy.allowsFeature("camera")) return "blockedByPolicy";
    } catch {
      // Se non risponde, si prosegue coi controlli qui sotto.
    }
  }

  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    if (status.state === "denied") return "denied";
  } catch {
    // Il browser non sa rispondere: si prosegue col controllo qui sotto.
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some((device) => device.kind === "videoinput")) return "noCamera";
  } catch {
    // Idem.
  }

  return "failed";
}

export default function Scan() {
  const t = useT();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  /* Il tipo vero è `QrScanner`, ma la libreria si carica solo nel browser e
     importarla per il tipo la tirerebbe dentro al pacchetto del server. */
  const scannerRef = useRef<{
    stop: () => void;
    destroy: () => void;
    setCamera: (idOrFacingMode: string) => Promise<void>;
  } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [rejected, setRejected] = useState(false);
  const [cameras, setCameras] = useState<CameraChoice[]>([]);
  const [activeCamera, setActiveCamera] = useState("");

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

      /* L'elenco si chiede **dopo** l'avvio, non prima: finché il permesso non
         è stato dato, `enumerateDevices` restituisce sì le fotocamere, ma con
         l'etichetta vuota — una tendina con tre voci senza nome non serve a
         nessuno. A permesso dato i nomi ci sono («FaceTime HD Camera»,
         «Back Ultra Wide Camera»), ed è quello che rende la scelta possibile. */
      try {
        const found = await QrScanner.listCameras(true);
        setCameras(found.map((camera) => ({ id: camera.id, label: camera.label })));
      } catch {
        // Senza elenco si resta con la fotocamera che è partita: si scansiona
        // lo stesso, manca solo la possibilità di cambiarla.
      }
    } catch (error) {
      console.error("Avvio della fotocamera fallito:", error);
      setStatus(await diagnoseCameraFailure());
    }
  }

  async function switchCamera(id: string) {
    setActiveCamera(id);
    try {
      await scannerRef.current?.setCamera(id);
    } catch (error) {
      console.error("Cambio di fotocamera fallito:", error);
    }
  }

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("scan.heading")}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">{t("scan.intro")}</p>

        {/* **`relative` non è decorazione.** `qr-scanner` aggiunge la cornice
            gialla dell'area di scansione come figlio del genitore del video,
            con `position: absolute`: senza un genitore posizionato, quella
            cornice si àncora a un antenato qualsiasi e finisce fuori posto. */}
        <div className="relative mt-6 overflow-hidden rounded border border-rule bg-sunk">
          {/* **Il video non si nasconde mai con `display: none`.** Un video
              nascosto così non disegna fotogrammi: il canvas che deve leggere
              il QR riceve nero, e `offsetWidth`/`offsetHeight` — con cui la
              libreria calcola l'area di scansione — valgono zero. La libreria
              sistema da sola l'*attributo* `hidden`, ma contro una classe CSS
              non può fare niente. Prima di questa correzione la fotocamera si
              accendeva e non si vedeva niente, e nessun QR veniva mai letto.
              Il messaggio di stato gli va quindi *sopra*, non al posto suo.

              `object-contain` e non `object-cover`: in uno scanner si deve
              vedere **tutto** il fotogramma. Con un ritaglio, la cornice
              gialla dell'area di lettura mostra un pezzo di immagine che
              l'occhio non vede, e si finisce per allineare il QR con quello
              che si vede invece che con quello che viene letto. Le bande nere
              ai lati sono il prezzo, ed è quello che fa ogni mirino.

              `playsInline` o su iPhone il video parte a schermo intero, e chi
              scansiona perde di vista la pagina sotto. `muted` perché senza,
              la riproduzione automatica viene bloccata. */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full bg-black object-contain"
          />

          {status !== "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center bg-sunk px-6 text-center text-sm text-muted">
              {status === "blockedByPolicy"
                ? t("scan.blockedByPolicy")
                : status === "denied"
                  ? t("scan.denied")
                  : status === "noCamera"
                    ? t("scan.noCamera")
                    : status === "failed"
                      ? t("scan.failed")
                      : status === "starting"
                        ? t("scan.starting")
                        : t("scan.idle")}
            </div>
          )}
        </div>

        {/* La scelta della fotocamera compare solo quando ce n'è più di una:
            una tendina con una voce sola è una domanda senza alternative. */}
        {status === "scanning" && cameras.length > 1 && (
          <div className="mt-4">
            <label
              htmlFor="camera"
              className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
            >
              {t("scan.camera")}
            </label>
            <div className="mt-1.5">
              <Select
                id="camera"
                name="camera"
                value={activeCamera}
                onChange={(event) => void switchCamera(event.target.value)}
              >
                {/* Senza `value` combaciante la tendina partirebbe vuota: la
                    fotocamera scelta dal ripiego della libreria non ha un id
                    che conosciamo finché non si sceglie a mano. */}
                {!activeCamera && <option value="">{t("scan.cameraAuto")}</option>}
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {status !== "scanning" && (
          <button
            type="button"
            onClick={() => void start()}
            disabled={status === "starting" || status === "noCamera"}
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
