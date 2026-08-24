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
 * la sola webcam frontale non c'è scelta da fare, e cambiare fotocamera per
 * forza vorrebbe solo dire riavviare lo stream per niente.
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
 * Le parti di `MediaStreamTrack` che i tipi del DOM non conoscono.
 *
 * `zoom` e `focusMode` non stanno nello standard: ci sono su Android Chrome,
 * non su iOS Safari, dove `getCapabilities()` restituisce quasi tutto
 * `undefined`. Dichiarati opzionali apposta, così ogni uso resta obbligato a
 * controllare prima.
 */
type CameraCapabilities = MediaTrackCapabilities & {
  zoom?: { min: number; max: number; step: number };
  focusMode?: string[];
};

function videoTrackOf(video: HTMLVideoElement | null): MediaStreamTrack | null {
  const stream = video?.srcObject;
  if (!(stream instanceof MediaStream)) return null;
  return stream.getVideoTracks()[0] ?? null;
}

/**
 * Le capacità della fotocamera, col cast confinato qui.
 *
 * `MediaStreamTrack.getCapabilities()` è tipizzato con lo standard, che di
 * `zoom` e `focusMode` non sa niente: invece di allargare il tipo ovunque —
 * dove poi verrebbe dimenticato che quei campi possono mancare — la bugia sta
 * in questa riga sola, e chi chiama riceve tutto `undefined` finché non
 * controlla. Un oggetto vuoto quando il browser non sa rispondere, così chi
 * legge non deve gestire anche il caso «non c'è il metodo».
 */
function cameraCapabilities(track: MediaStreamTrack): CameraCapabilities {
  return (track.getCapabilities?.() ?? {}) as CameraCapabilities;
}

/**
 * Messa a fuoco continua, dove il telefono la sa fare.
 *
 * È il singolo accorgimento che cambia di più: un adesivo tenuto a venti
 * centimetri, senza autofocus continuo, resta sfocato finché la fotocamera non
 * decide da sola di rimettere a fuoco — e nel frattempo sembra che lo scanner
 * non funzioni. Su iOS `getCapabilities()` non dice quasi niente e questa
 * chiamata non fa nulla: nessun danno, il telefono mette a fuoco per conto suo.
 */
async function tuneCamera(video: HTMLVideoElement | null): Promise<void> {
  const track = videoTrackOf(video);
  if (!track || !cameraCapabilities(track).focusMode?.includes("continuous")) return;

  try {
    await track.applyConstraints({
      advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
    });
  } catch {
    // Un vincolo rifiutato non è un guasto: si scansiona lo stesso.
  }
}

/** Quanto si aspetta prima di cominciare ad avvicinarsi da soli. */
const ZOOM_HUNT_AFTER_MS = 2500;
/** Ogni quanto si sale di un gradino mentre si cerca. */
const ZOOM_STEP_MS = 1200;
/** Il tetto: oltre il doppio si perde inquadratura più di quanto si guadagni. */
const ZOOM_CEILING = 2;

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
  const [status, setStatus] = useState<Status>("starting");
  const [rejected, setRejected] = useState(false);
  const [cameras, setCameras] = useState<CameraChoice[]>([]);
  const [activeCamera, setActiveCamera] = useState("");
  /* Guardia contro il doppio avvio. In sviluppo React monta, smonta e rimonta
     ogni componente per far emergere gli effetti non puliti: senza questa,
     partirebbero due scanner sulla stessa fotocamera e il primo resterebbe
     acceso senza che nessuno lo spenga. */
  const startedRef = useRef(false);

  // Spegnere la fotocamera quando si lascia la pagina non è un dettaglio: se
  // resta accesa, sul telefono resta acceso anche il puntino verde e la
  // batteria se ne va senza che nessuno stia guardando niente.
  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
      startedRef.current = false;
    };
  }, []);

  /**
   * La fotocamera parte da sola all'apertura della pagina.
   *
   * Il pulsante «Avvia» era un gesto in più su una schermata che ha un solo
   * scopo: chi arriva qui vuole scansionare, e la pagina si raggiunge già
   * premendo «Scansiona» nel menu. Resta come via di ritorno quando l'avvio
   * fallisce — lì il gesto serve davvero, perché senza si riproverebbe da
   * solo all'infinito.
   *
   * Su iOS il permesso viene chiesto anche senza un tocco, purché la scheda
   * sia quella in primo piano; nei browser dentro ad altre app (WKWebView)
   * può non bastare, ed è esattamente il caso che il pulsante di ripiego
   * copre.
   */
  useEffect(() => {
    void start();
    // Una volta sola, all'apertura: `start` legge solo dei ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Se non trova niente, si avvicina da solo.
   *
   * L'idea è quella dello scanner di Telegram: un adesivo piccolo, o
   * inquadrato da un metro, occupa troppi pochi pixel perché il decodificatore
   * lo veda, e l'unico rimedio è avvicinare — con le mani o con lo zoom.
   * Qui si aspettano un paio di secondi (il tempo di inquadrare come si deve)
   * e poi si sale di un gradino alla volta fino al doppio; arrivati in cima si
   * torna all'inizio e si ricomincia, perché lo zoom sbagliato è un problema
   * tanto quanto la distanza.
   *
   * **Non è un vero rilevamento come quello di Telegram**, che stima la
   * distanza del codice e zooma di conseguenza: quello richiede di sapere
   * *dove* è il QR prima di averlo letto, cosa che il decodificatore in un
   * browser non racconta. Questa è una ricerca cieca, ma copre lo stesso caso
   * — il codice che si vede e non si legge — senza chiedere niente a chi
   * scansiona.
   *
   * Si ferma da sola quando il decodificatore trova qualcosa: a quel punto la
   * pagina cambia. Su iOS `zoom` non esiste e questo effetto esce subito.
   */
  useEffect(() => {
    if (status !== "scanning") return;

    const track = videoTrackOf(videoRef.current);
    const zoom = track ? cameraCapabilities(track).zoom : undefined;
    if (!track || !zoom || zoom.max <= zoom.min) return;

    const ceiling = Math.min(zoom.max, zoom.min * ZOOM_CEILING);
    const step = Math.max(zoom.step || 0.1, (ceiling - zoom.min) / 4);
    let current = zoom.min;

    let timer: ReturnType<typeof setInterval> | undefined;

    // I primi secondi si sta fermi: chi inquadra ha bisogno di un attimo per
    // centrare l'adesivo, e uno zoom che parte subito glielo sposta via
    // mentre lo sta cercando.
    const delay = setTimeout(() => {
      timer = setInterval(() => {
        current = current + step > ceiling ? zoom.min : current + step;
        void track
          .applyConstraints({ advanced: [{ zoom: current } as MediaTrackConstraintSet] })
          .catch(() => {
            // Se il telefono rifiuta lo zoom, tanto vale smettere di chiederlo.
            if (timer) clearInterval(timer);
          });
      }, ZOOM_STEP_MS);
    }, ZOOM_HUNT_AFTER_MS);

    return () => {
      clearTimeout(delay);
      if (timer) clearInterval(timer);
      // Si riparte sempre da fermo: lo zoom lasciato a metà si porterebbe
      // dietro alla prossima apertura della pagina.
      void track
        .applyConstraints({ advanced: [{ zoom: zoom.min } as MediaTrackConstraintSet] })
        .catch(() => {});
    };
  }, [status]);

  async function start() {
    if (!videoRef.current || startedRef.current) return;
    startedRef.current = true;
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
          // Il primo tentativo: «una di dietro». Quale sia di preciso lo si
          // corregge subito dopo con `pickRearCamera`, quando le etichette
          // esistono — vedi lì il perché.
          preferredCamera: "environment",
          highlightScanRegion: true,
          /* Dieci al secondo e non cinque. Cinque vuol dire fino a due decimi
             di ritardo fra l'aver inquadrato bene e l'essere letti, che si
             sentono tutti; e il costo è più basso di quanto sembri, perché
             dove c'è `BarcodeDetector` — Android Chrome — la libreria lo usa
             al posto del suo decodificatore, e lì è il sistema operativo a
             leggere il codice, non JavaScript. Oltre i dieci si scalda la
             batteria senza guadagnare niente di percepibile. */
          maxScansPerSecond: 10,
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
        const choices = found.map((camera) => ({ id: camera.id, label: camera.label }));
        setCameras(choices);

        /* Ora che le etichette ci sono, si sceglie quella buona. `environment`
           ha già dato *una* fotocamera di dietro, ma su Android quale sia è
           una lotteria: se non è la principale, si cambia adesso. Il confronto
           è sul `deviceId` di ciò che sta effettivamente scorrendo, non su
           quello che abbiamo chiesto. */
        const best = pickRearCamera(choices);
        const current = videoTrackOf(videoRef.current)?.getSettings().deviceId;
        if (best && best !== current) {
          await scanner.setCamera(best);
        }
        setActiveCamera(best ?? current ?? "");
      } catch {
        // Senza elenco si resta con la fotocamera che è partita: si scansiona
        // lo stesso, manca solo la possibilità di cambiarla.
      }

      await tuneCamera(videoRef.current);
    } catch (error) {
      console.error("Avvio della fotocamera fallito:", error);
      startedRef.current = false;
      setStatus(await diagnoseCameraFailure());
    }
  }

  async function switchCamera(id: string) {
    setActiveCamera(id);
    try {
      await scannerRef.current?.setCamera(id);
      // Lo stream è nuovo, quindi la messa a fuoco va richiesta di nuovo: le
      // impostazioni non sopravvivono al cambio di fotocamera.
      await tuneCamera(videoRef.current);
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

        {/* Solo quando c'è qualcosa da riprovare. La fotocamera parte da sola
            all'apertura, quindi in condizioni normali questo pulsante non si
            vede mai: era un gesto in più su una schermata che ha un solo
            scopo. Quando invece l'avvio è fallito il gesto serve davvero —
            senza, si riproverebbe da solo all'infinito contro un permesso
            negato. Niente pulsante se non c'è nessuna fotocamera: lì non
            esiste un «riprova» che possa andare a buon fine. */}
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
