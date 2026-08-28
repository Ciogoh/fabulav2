/**
 * Il lato browser delle notifiche: chiedere il permesso, iscriversi,
 * disiscriversi.
 *
 * Sta in un file suo e non dentro alla schermata perché è tutto codice che
 * parla con API del browser e non con React — e perché il giro è pieno di
 * trappole che vanno spiegate una volta sola:
 *
 *  - il permesso si può chiedere **solo** da un gesto vero della persona;
 *  - se viene negato, dal sito non si può più riaprire la domanda: la
 *    finestra non compare nemmeno, e il pulsante sembra rotto;
 *  - un'iscrizione appartiene al **dispositivo**, non alla persona: telefono
 *    e portatile sono due righe nel database.
 */

/** Cosa può rispondere il browser quando gli si chiede di notificare. */
export type PushPermission = "unsupported" | "default" | "granted" | "denied";

export function pushPermission(): PushPermission {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission as "default" | "granted" | "denied";
}

/**
 * La chiave VAPID viaggia come testo in base64url e il browser la pretende
 * come byte grezzi. La conversione è meccanica e sempre uguale: `-` e `_`
 * sono la variante «sicura per URL» di `+` e `/`, e il riempimento con `=`
 * va rimesso perché `atob` lo esige.
 */
function decodeKey(base64url: string): ArrayBuffer {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));

  // Il buffer si alloca a mano invece di usare `Uint8Array.from`: quella
  // restituisce un `Uint8Array<ArrayBufferLike>`, che comprende anche il caso
  // della memoria condivisa fra thread e che `applicationServerKey` rifiuta.
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

async function ready(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // `ready` aspetta che *un* service worker sia attivo. Su una scheda aperta
  // prima della prima registrazione può restare in attesa a lungo, ma qui si
  // arriva solo da un click, quindi la registrazione è già partita.
  return navigator.serviceWorker.ready;
}

/** L'iscrizione di **questo** dispositivo, se c'è. */
export async function currentEndpoint(): Promise<string | null> {
  const registration = await ready();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

export type EnableResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: "unsupported" | "denied" | "dismissed" | "failed" };

/**
 * Il giro completo: permesso, iscrizione al servizio push del browser,
 * consegna al nostro server.
 *
 * L'ordine conta. Si chiede il permesso **prima** di iscriversi perché
 * `subscribe()` lo chiederebbe da solo, ma senza distinguere «ha detto no»
 * da «è andato storto qualcosa», e sono due messaggi diversi da mostrare.
 */
export async function enablePush(vapidPublicKey: string): Promise<EnableResult> {
  if (pushPermission() === "unsupported") return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  // Su Chrome chiudere la finestrella senza scegliere lascia `default`: non è
  // un no definitivo e il pulsante deve restare premibile.
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  try {
    const registration = await ready();
    if (!registration) return { ok: false, reason: "unsupported" };

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Obbligatorio: promette al browser che ogni push produrrà una
        // notifica visibile. Chrome revoca il permesso a chi non mantiene.
        userVisibleOnly: true,
        applicationServerKey: decodeKey(vapidPublicKey),
      }));

    const saved = await post({ intent: "subscribe", subscription: subscription.toJSON() });
    if (!saved) return { ok: false, reason: "failed" };

    return { ok: true, endpoint: subscription.endpoint };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * Toglie l'iscrizione di questo dispositivo.
 *
 * Prima si avvisa il server e poi si annulla nel browser, non il contrario:
 * se cade la rete a metà, la riga resta nel database e il server la
 * cancellerà da solo al primo 410 del servizio push. All'inverso resterebbe
 * un'iscrizione fantasma che il server continua a considerare viva mentre
 * il browser non la conosce più.
 */
export async function disablePush(): Promise<boolean> {
  const registration = await ready();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return true;

  await post({ intent: "unsubscribe", endpoint: subscription.endpoint });
  return subscription.unsubscribe();
}

/** «Manda una notifica di prova»: il server spedisce a questo dispositivo. */
export async function testPush(): Promise<boolean> {
  const endpoint = await currentEndpoint();
  return post({ intent: "test", endpoint });
}

async function post(body: unknown): Promise<boolean> {
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok;
}
