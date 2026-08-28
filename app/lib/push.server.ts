/**
 * L'invio delle notifiche push: il gemello di `email.server.ts`.
 *
 * Stessa forma e stessa promessa: una funzione sola che spedisce, e un
 * errore che non deve mai far fallire l'azione che l'ha innescata. Chi ha
 * approvato una richiesta l'ha approvata, a prescindere da un servizio push
 * che non risponde.
 *
 * ── Perché qui una libreria e per Resend no ──────────────────────────────
 * `email.server.ts` chiama Resend con un `fetch`, perché è una POST con un
 * token. Una notifica push no: va cifrata da capo a fondo con uno scambio di
 * chiavi ECDH e `aes128gcm`, e la chiave del server va firmata come JWT
 * VAPID. È crittografia vera. Scritta a mano sarebbe il tipo di codice che
 * sembra funzionare finché non funziona, quindi `web-push` si paga da sola.
 *
 * ── Cosa può stare dentro a una notifica ────────────────────────────────
 * Nel corpo non vanno **nomi di persona né luoghi**. Una notifica si legge a
 * schermo bloccato, in mezzo alla gente: è una superficie semi-pubblica.
 * «Nuova richiesta — 3 oggetti, 20–25 ago» basta; chi ha chiesto si vede
 * aprendo. È la stessa regola per cui il catalogo dice che un oggetto è
 * occupato ma non da chi.
 */

import webpush from "web-push";
import { db } from "~/lib/db.server";

export type PushMessage = {
  title: string;
  body: string;
  /** Dove porta il tocco. Relativo, non assoluto: il service worker lo
   * risolve sull'origine da cui è stato installato. */
  url: string;
  /** Notifiche con lo stesso `tag` si sostituiscono invece di impilarsi.
   * Ci va l'id della richiesta: tre messaggi nella stessa chat devono essere
   * una riga sola nel centro notifiche, non tre. */
  tag?: string;
};

/**
 * EXPERIMENTAL — spento apposta, non per chiavi mancanti.
 *
 * Verificato il 28 agosto 2026: l'iscrizione arriva al server, il server la
 * salva, `webpush.sendNotification` la manda senza sollevare un errore — ma
 * su desktop (macOS + Brave, il caso provato) non compare mai a schermo. La
 * causa non è stata isolata da remoto (permesso del sito concesso, servizi
 * push di Google riattivati in Brave, nessun errore nei log). Finché non si
 * riprende in mano con calma — magari direttamente su un telefono vero, che
 * è comunque un passo ancora da fare — resta spento qui: una bandiera sola,
 * una riga da girare quando si ricomincia.
 */
const PUSH_NOTIFICATIONS_ENABLED = false;

/**
 * Le chiavi, lette una volta sola.
 *
 * Se mancano, le notifiche restano spente e tutto continua a funzionare via
 * email: è lo stesso patto di `RESEND_API_KEY` in sviluppo. Un'installazione
 * senza chiavi VAPID non è rotta, è un'installazione che manda solo email.
 */
let configured: boolean | null = null;

function ready(): boolean {
  if (!PUSH_NOTIFICATIONS_ENABLED) return false;
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** La chiave pubblica, per il browser che si iscrive. `null` = spente. */
export function vapidPublicKey(): string | null {
  return ready() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

/**
 * Manda una notifica a tutti i dispositivi di una persona.
 *
 * **Restituisce quante ne sono partite davvero**, e non è un dettaglio: è il
 * valore su cui `notifications.server.ts` decide se ripiegare sull'email.
 * Uno zero qui significa «questa persona non è stata avvisata», e senza
 * quel numero non c'è modo di distinguerlo da «mandata».
 */
export async function sendPush(userId: string, message: PushMessage): Promise<number> {
  if (!ready()) return 0;

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return 0;

  const payload = JSON.stringify(message);

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          // Se il telefono è spento, il servizio push tiene il messaggio per
          // un giorno e poi lo butta. Più in là non ha senso: un promemoria
          // di riconsegna di ieri non serve a nessuno.
          { TTL: 60 * 60 * 24 }
        );
        return subscription.id;
      } catch (error) {
        await forget(subscription.id, error);
        return null;
      }
    })
  );

  const delivered = results.filter((id): id is string => id !== null);

  if (delivered.length > 0) {
    // Serve solo alla schermata del profilo, per far riconoscere alla
    // persona quale dei suoi dispositivi è ancora vivo. Non si aspetta: se
    // fallisce, la notifica è comunque partita.
    void db.pushSubscription
      .updateMany({ where: { id: { in: delivered } }, data: { lastSuccessAt: new Date() } })
      .catch(() => {});
  }

  return delivered.length;
}

/**
 * Cancella un'iscrizione che il servizio push ha dichiarato morta.
 *
 * 404 e 410 sono le due risposte che significano «questo indirizzo non
 * esiste più»: app disinstallata, dati del browser puliti, icona tolta dalla
 * schermata Home. Senza questa pulizia la tabella si riempie di indirizzi
 * che falliscono per sempre, e ogni avviso diventa più lento del precedente.
 *
 * Ogni altro errore — servizio giù, rete che non va — **non** cancella
 * niente: sarebbe il modo più veloce di disiscrivere tutti durante un guasto
 * temporaneo di Google.
 */
async function forget(id: string, error: unknown): Promise<void> {
  const status = (error as { statusCode?: number })?.statusCode;

  if (status === 404 || status === 410) {
    await db.pushSubscription.delete({ where: { id } }).catch(() => {});
    return;
  }

  console.error(`Notifica push non consegnata (${status ?? "errore di rete"}):`, error);
}
