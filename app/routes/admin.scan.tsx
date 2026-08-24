/**
 * Lo scanner: inquadra l'adesivo di un oggetto e ti porta alla sua consegna.
 *
 * **Funziona col telefono in magazzino e con la webcam di un portatile.** Il
 * telefono è il caso per cui è nato, ma la webcam non è un ripiego di
 * cortesia: chi sta alla scrivania con un oggetto in mano deve poterlo
 * consegnare senza tirare fuori il telefono.
 *
 * ## Perché il ciclo è scritto qui e non preso da una libreria
 *
 * Prima questa pagina usava `qr-scanner`, che fa tutto — fotocamera, ciclo,
 * decodifica — e lo fa bene. È stata tolta per una ragione sola: **il ciclo è
 * il posto dove si decide quanto lontano si riesce a leggere**, e da dentro
 * una libreria quel posto non si tocca. `qr-scanner` legge un quadrato
 * centrale ridotto a 400 pixel: un adesivo a mezzo metro lì dentro diventa una
 * manciata di pixel e non lo legge nessun decodificatore, per quanto buono
 * sia. Il ciclo qui sotto legge invece **due aree alternate** (vedi
 * `scanLoop`), ed è quello — non il decodificatore — a cambiare la distanza
 * utile.
 *
 * La decodifica vera sta in `lib/qr-engine.ts`: `BarcodeDetector` dove c'è
 * (Android: legge il sistema operativo, non JavaScript), `zxing-wasm` dove
 * non c'è, cioè su iPhone.
 *
 * ## Cinque cose non ovvie sui browser e le fotocamere
 *
 * 1. **`facingMode: { exact: "environment" }` fallisce sui portatili**, che
 *    non hanno una fotocamera posteriore: rispondono `OverconstrainedError`
 *    (verificato). Per questo `openCamera` prova una scaletta di vincoli e
 *    scende di pretesa a ogni fallimento, invece di chiedere una cosa sola.
 * 2. **`facingMode` non basta comunque a scegliere bene su Android**: dice
 *    «una di dietro», e quale sia è una lotteria fra principale, grandangolare
 *    e teleobiettivo. Vedi `pickRearCamera`.
 * 3. **Le etichette delle fotocamere esistono solo dopo il permesso.** Prima
 *    `enumerateDevices` le restituisce senza nome, quindi l'ordine è
 *    obbligato: apri una fotocamera qualsiasi, poi elenca, poi correggi.
 * 4. **La fotocamera si chiede una risoluzione alta.** È gratis in termini di
 *    codice e raddoppia la distanza utile: un QR che a 640 pixel è illeggibile
 *    a 1920 si legge benissimo.
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

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/admin.scan";
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { Select } from "~/components/select";
import { pageTitle } from "~/i18n/meta";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";
import type { QrEngine } from "~/lib/qr-engine";

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
 *
 * **Accetta due forme**: quella corta e maiuscola stampata sugli adesivi
 * (`/H/CMT3...`) e quella lunga di prima (`/admin/handover/cmt3...`), che
 * resta valida perché un adesivo già attaccato non si stacca da solo. In
 * tutti e due i casi il percorso viene **ricostruito** dall'identificativo
 * catturato, mai riusato com'era: così query e frammenti non passano.
 */
export function handoverPathFrom(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.origin.toUpperCase() !== origin.toUpperCase()) return null;

  const short = /^\/H\/([A-Za-z0-9]{1,64})$/i.exec(url.pathname);
  if (short) return `/admin/handover/${short[1].toLowerCase()}`;

  const long = /^\/admin\/handover\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
  return long ? `/admin/handover/${long[1]}` : null;
}

type Status =
  | "starting"
  | "scanning"
  | "denied"
  | "noCamera"
  | "blockedByPolicy"
  | "failed";

type CameraChoice = { id: string; label: string };

/** Posteriore. `environment` compare su qualche browser al posto di «back». */
const REAR = /\b(back|rear|environment|posteriore|rück)/i;

/**
 * Le fotocamere posteriori che **non** sono quella principale.
 *
 * Un telefono moderno ne espone tre o quattro dietro, e solo una è quella
 * buona per leggere un codice: la grandangolare spinge il soggetto lontano e
 * legge male da vicino, il teleobiettivo non mette a fuoco a venti
 * centimetri, e le camere di profondità o monocromatiche non servono affatto.
 * `wide` da solo non entra nell'elenco: su iPhone la principale si chiama
 * «Back Dual Wide Camera», e scartarla vorrebbe dire scartare proprio quella
 * giusta.
 */
const SECONDARY_REAR = /(ultra|tele|macro|depth|monochrom|mono\b|bokeh|infrared|\bir\b)/i;

/**
 * Quale fotocamera posteriore usare, scelta dalle etichette.
 *
 * **`facingMode: "environment"` non basta**, ed è il motivo per cui questa
 * funzione esiste: chiede «una di dietro», e su Android il browser ne
 * consegna spesso una qualsiasi — capita la grandangolare, che a venti
 * centimetri da un adesivo restituisce un quadratino illeggibile.
 *
 * Su Android le etichette hanno la forma `camera2 0, facing back`, e **quel
 * numero è l'ordine deciso dal produttore**: lo zero è la fotocamera
 * principale, quella che si apre quando apri l'app Fotocamera. Le altre
 * posteriori (di solito la 2) sono grandangolare, teleobiettivo o profondità.
 * Si prende quindi la posteriore con l'indice più basso fra quelle che non
 * sembrano secondarie.
 *
 * Su iPhone il formato è un altro — «Back Camera», «Back Ultra Wide Camera» —
 * e lì non c'è nessun indice: vale il filtro sui nomi, e «Back Camera» resta
 * in cima perché l'ordine di enumerazione la mette per prima.
 *
 * Restituisce `null` quando non c'è niente di posteriore: su un portatile con
 * la sola webcam frontale non c'è scelta da fare.
 */
export function pickRearCamera(cameras: CameraChoice[]): string | null {
  const rear = cameras.filter((camera) => REAR.test(camera.label));
  if (rear.length === 0) return null;

  // Se togliendo le secondarie non resta niente, meglio una grandangolare che
  // niente: vuol dire che le etichette non seguono nessuno schema noto.
  const primary = rear.filter((camera) => !SECONDARY_REAR.test(camera.label));
  const pool = primary.length > 0 ? primary : rear;

  const numbered = pool
    .map((camera) => ({
      camera,
      index: Number(/camera2\s+(\d+)/i.exec(camera.label)?.[1] ?? Number.NaN),
    }))
    .filter((entry) => Number.isFinite(entry.index))
    .sort((a, b) => a.index - b.index);

  return (numbered[0]?.camera ?? pool[0]).id;
}

/**
 * Apre una fotocamera, scendendo di pretesa a ogni rifiuto.
 *
 * La risoluzione si chiede **alta** perché è da lì che viene la distanza
 * utile: un adesivo a mezzo metro dentro a un fotogramma da 640 pixel occupa
 * venti pixel e non lo legge nessuno, dentro a uno da 1920 ne occupa sessanta
 * e si legge. `ideal` e non `min`: se il dispositivo non ce la fa, dà quello
 * che ha invece di rifiutare.
 *
 * L'ordine dei tentativi conta. `{ exact: "environment" }` è l'unico modo di
 * dire «voglio davvero quella di dietro» — senza `exact` il browser lo tratta
 * come un desiderio e su un telefono può darti la frontale — ma fallisce su
 * un portatile, che una posteriore non ce l'ha. Da qui la scaletta.
 */
async function openCamera(deviceId?: string): Promise<MediaStream> {
  const resolution = { width: { ideal: 1920 }, height: { ideal: 1080 } };

  const attempts: MediaTrackConstraints[] = deviceId
    ? [{ ...resolution, deviceId: { exact: deviceId } }]
    : [
        { ...resolution, facingMode: { exact: "environment" } },
        { ...resolution, facingMode: "environment" },
        resolution,
      ];

  let lastError: unknown;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Nessuna fotocamera disponibile.");
}

/**
 * Perché la fotocamera non è partita.
 *
 * Serve una domanda esplicita al browser perché l'errore di `getUserMedia`
 * non distingue abbastanza: permesso negato, assenza di fotocamera e
 * `Permissions-Policy` che ce la vieta hanno vie d'uscita completamente
 * diverse — una si risolve nelle impostazioni del browser, una non si risolve
 * affatto, e la terza si risolve solo sul server.
 *
 * `navigator.permissions` non conosce `camera` su Firefox e su Safari: lì la
 * domanda fallisce, si ripiega sul messaggio generico, e va bene così — un
 * messaggio meno preciso è meglio di uno sbagliato.
 */
async function diagnoseCameraFailure(): Promise<Status> {
  /* Prima di tutto: siamo noi a vietarcela? `Permissions-Policy` con
     `camera=()` significa «nessuna origine, noi compresi», e in quel caso il
     browser non chiede il permesso e non lo chiederà mai — darglielo a mano
     non cambia niente. È successo davvero: `root.tsx` spegneva la fotocamera
     da prima che ci fosse uno scanner. Va chiesto per primo perché
     `permissions.query` in quel caso risponde «denied» come per un rifiuto
     vero, e il consiglio da dare è l'opposto. */
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
    // Il browser non sa rispondere: si prosegue.
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some((device) => device.kind === "videoinput")) return "noCamera";
  } catch {
    // Idem.
  }

  return "failed";
}

/**
 * `document.featurePolicy` non sta nei tipi del DOM perché non è standard:
 * c'è su Chrome ed Edge, non su Firefox né Safari. Si dichiara qui il minimo
 * che ci serve — opzionale, così il controllo dell'esistenza resta
 * obbligatorio e non ci si può dimenticare che altrove non c'è.
 */
type DocumentWithFeaturePolicy = Document & {
  featurePolicy?: { allowsFeature(feature: string): boolean };
};

/** Quanti fotogrammi al secondo si prova a leggere. */
const SCANS_PER_SECOND = 10;
/** Il lato massimo dell'immagine data al decodificatore nella passata larga. */
const WIDE_PASS_SIZE = 720;
/** Quanto della larghezza del fotogramma copre la passata ravvicinata. */
const CLOSE_PASS_FRACTION = 0.45;

export default function Scan() {
  const t = useT();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<QrEngine | null>(null);
  const runningRef = useRef(false);
  const startedRef = useRef(false);

  const [status, setStatus] = useState<Status>("starting");
  const [rejected, setRejected] = useState(false);
  const [cameras, setCameras] = useState<CameraChoice[]>([]);
  const [activeCamera, setActiveCamera] = useState("");

  /** Spegne la fotocamera. Se resta accesa, sul telefono resta acceso anche
   * il puntino verde e la batteria se ne va senza che nessuno guardi niente. */
  const stopCamera = useCallback(() => {
    runningRef.current = false;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /**
   * Il ciclo di lettura, **due aree alternate**.
   *
   * È qui che si decide quanto lontano si riesce a leggere, ed è la ragione
   * per cui questo ciclo è scritto a mano invece che preso da una libreria.
   *
   * - **Passata larga**: tutto il fotogramma, rimpicciolito a 720 pixel di
   *   lato. Costa poco e trova qualunque codice vicino, ovunque sia
   *   nell'inquadratura — non serve centrarlo.
   * - **Passata ravvicinata**: il 45% centrale del fotogramma, ritagliato
   *   **alla risoluzione vera della fotocamera**. È uno zoom digitale senza
   *   toccare l'ottica: il codice lontano che nella passata larga era venti
   *   pixel, qui ne è sessanta, e si legge.
   *
   * Alternandole si copre il vicino e il lontano senza chiedere niente a chi
   * scansiona, e senza muovere lo zoom sotto le sue mani — che era il difetto
   * della versione precedente: la fotocamera si allontanava da sola proprio
   * mentre stavi centrando l'adesivo.
   */
  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    const decode = engineRef.current;
    if (!video || !decode) return;

    const canvas = document.createElement("canvas");
    // `willReadFrequently` dice al browser di tenere il canvas in memoria
    // normale invece che sulla scheda video: qui si legge ogni fotogramma, e
    // senza, ogni `getImageData` costringe a un viaggio di ritorno dalla GPU.
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    let closePass = false;

    while (runningRef.current) {
      const started = performance.now();

      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width > 0 && height > 0) {
        let sx = 0;
        let sy = 0;
        let sw = width;
        let sh = height;
        let dw = width;
        let dh = height;

        if (closePass) {
          sw = Math.round(width * CLOSE_PASS_FRACTION);
          sh = Math.round(height * CLOSE_PASS_FRACTION);
          sx = Math.round((width - sw) / 2);
          sy = Math.round((height - sh) / 2);
          // Nessun ridimensionamento: è tutto il senso di questa passata.
          dw = sw;
          dh = sh;
        } else {
          const scale = Math.min(1, WIDE_PASS_SIZE / Math.max(width, height));
          dw = Math.round(width * scale);
          dh = Math.round(height * scale);
        }

        canvas.width = dw;
        canvas.height = dh;
        context.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);

        try {
          const text = await decode(context.getImageData(0, 0, dw, dh));
          if (text) {
            const path = handoverPathFrom(text, window.location.origin);
            if (path) {
              stopCamera();
              navigate(path);
              return;
            }
            /* Un QR che non è dei nostri: si dice e si continua a inquadrare.
               Fermarsi obbligherebbe a ricominciare ogni volta che entra
               nell'inquadratura il codice a barre di una scatola. */
            setRejected(true);
          }
        } catch (error) {
          console.error("Lettura del fotogramma fallita:", error);
        }
      }

      closePass = !closePass;

      const elapsed = performance.now() - started;
      const wait = Math.max(0, 1000 / SCANS_PER_SECOND - elapsed);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }, [navigate, stopCamera]);

  const attach = useCallback(
    async (stream: MediaStream) => {
      const video = videoRef.current;
      if (!video) return;

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      /* Specchiata solo se è quella che guarda te: su una frontale un testo
         non specchiato è disorientante, su una posteriore lo specchio è
         semplicemente sbagliato. La lettura non ne risente in nessun caso —
         il canvas disegna il fotogramma vero, non quello trasformato dal CSS. */
      const facing = stream.getVideoTracks()[0]?.getSettings().facingMode;
      video.style.transform = facing === "user" ? "scaleX(-1)" : "";

      // Messa a fuoco continua dove il telefono la sa fare: è l'accorgimento
      // che cambia di più da vicino. Senza, un adesivo a venti centimetri
      // resta sfocato finché la fotocamera non ci ripensa da sola, e nel
      // frattempo sembra che lo scanner sia rotto.
      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() ?? {}) as {
        focusMode?: string[];
      };
      if (track && capabilities.focusMode?.includes("continuous")) {
        await track
          .applyConstraints({
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          })
          .catch(() => {});
      }
    },
    []
  );

  const start = useCallback(async () => {
    if (!videoRef.current || startedRef.current) return;
    startedRef.current = true;
    setStatus("starting");
    setRejected(false);

    try {
      // Il motore in parallelo all'apertura della fotocamera: su iPhone si
      // porta dietro un megabyte di WebAssembly, e non c'è ragione di
      // aspettarlo prima di aver acceso la fotocamera.
      const [{ createQrEngine }, stream] = await Promise.all([
        import("~/lib/qr-engine"),
        openCamera(),
      ]);

      await attach(stream);

      /* Adesso che il permesso c'è, le etichette hanno un nome e si può
         scegliere quella giusta. Prima erano tutte vuote. */
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const choices = devices
          .filter((device) => device.kind === "videoinput")
          .map((device) => ({ id: device.deviceId, label: device.label }));
        setCameras(choices);

        const best = pickRearCamera(choices);
        const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (best && best !== current) {
          stopCamera();
          await attach(await openCamera(best));
        }
        setActiveCamera(best ?? current ?? "");
      } catch {
        // Senza elenco si resta con la fotocamera che è partita: si scansiona
        // lo stesso, manca solo la possibilità di cambiarla.
      }

      const engine = await createQrEngine();
      engineRef.current = engine.decode;

      setStatus("scanning");
      runningRef.current = true;
      void scanLoop();
    } catch (error) {
      console.error("Avvio della fotocamera fallito:", error);
      startedRef.current = false;
      stopCamera();
      setStatus(await diagnoseCameraFailure());
    }
  }, [attach, scanLoop, stopCamera]);

  /**
   * La fotocamera parte da sola all'apertura della pagina.
   *
   * Il pulsante «Avvia» era un gesto in più su una schermata che ha un solo
   * scopo: chi arriva qui vuole scansionare, e la pagina si raggiunge già
   * premendo «Scansiona» nel menu. Resta come via di ritorno quando l'avvio
   * fallisce — lì il gesto serve davvero, perché senza si riproverebbe da
   * solo all'infinito.
   *
   * La guardia `startedRef` non è pignoleria: in sviluppo React monta,
   * smonta e rimonta ogni componente per far emergere gli effetti non
   * puliti, e senza partirebbero due fotocamere.
   */
  useEffect(() => {
    void start();
    return () => {
      stopCamera();
      startedRef.current = false;
    };
  }, [start, stopCamera]);

  async function switchCamera(id: string) {
    setActiveCamera(id);
    try {
      stopCamera();
      await attach(await openCamera(id));
      runningRef.current = true;
      void scanLoop();
    } catch (error) {
      console.error("Cambio di fotocamera fallito:", error);
      setStatus(await diagnoseCameraFailure());
    }
  }

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("scan.heading")}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">{t("scan.intro")}</p>

        <div className="relative mt-6 overflow-hidden rounded border border-rule bg-sunk">
          {/* **Il video non si nasconde mai con `display: none`.** Un video
              nascosto così non disegna fotogrammi: il canvas che lo legge
              riceve nero. Il messaggio di stato gli va quindi *sopra*, non al
              posto suo.

              `object-contain` e non `object-cover`: in uno scanner si deve
              vedere tutto il fotogramma, perché tutto il fotogramma viene
              letto. Con un ritaglio si finirebbe per allineare il QR con
              quello che si vede invece che con quello che viene letto.

              `playsInline` o su iPhone il video parte a schermo intero, e chi
              scansiona perde di vista la pagina sotto. `muted` perché senza,
              la riproduzione automatica viene bloccata. */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full bg-black object-contain"
          />

          {/* Il quadrato di mira. Non delimita l'area letta — il fotogramma
              viene letto tutto — ma dice dove conviene mettere l'adesivo
              perché entri anche nella passata ravvicinata, che è quella che
              lo prende da lontano. */}
          {status === "scanning" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[45%] w-[45%] -translate-x-1/2 -translate-y-1/2 rounded border-2 border-accent/70"
            />
          )}

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
                      : t("scan.starting")}
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
                {!activeCamera && <option value="">{t("scan.cameraAuto")}</option>}
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || t("scan.cameraAuto")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Solo quando c'è qualcosa da riprovare: la fotocamera parte da sola,
            quindi in condizioni normali questo pulsante non si vede mai.
            Niente pulsante se non c'è nessuna fotocamera — lì non esiste un
            «riprova» che possa andare a buon fine. */}
        {(status === "denied" || status === "failed" || status === "blockedByPolicy") && (
          <button
            type="button"
            onClick={() => void start()}
            className={buttonClass("primary", "md", "mt-4")}
          >
            {t("scan.retry")}
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
