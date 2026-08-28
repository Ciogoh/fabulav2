/**
 * La rotta con cui un dispositivo si iscrive alle notifiche, si disiscrive, o
 * si fa mandare una prova.
 *
 * Rotta risorsa: nessun componente, solo un'azione. Non passa da un `<form>`
 * come il resto di Fabula perché l'iscrizione che il browser consegna è un
 * oggetto annidato — endpoint più due chiavi — e appiattirlo in campi di
 * modulo per poi ricomporlo sarebbe lavoro in più per nascondere un `fetch`.
 *
 * Sulla sicurezza, due cose e nessuna scorciatoia:
 *
 *  - `requireUser` in prima riga, come ogni azione che scrive (regola 4).
 *  - Un'iscrizione si tocca **solo se è tua**: la disiscrizione filtra per
 *    `userId` oltre che per endpoint. Senza, conoscere l'endpoint di un altro
 *    basterebbe a spegnergli le notifiche.
 *
 * Il corpo arriva come JSON, e questa è anche la difesa contro la richiesta
 * cross-site: `Content-Type: application/json` obbliga il browser a chiedere
 * prima il permesso con una preflight, che un sito qualunque non ottiene. Un
 * `<form>` da un altro dominio non può produrre questo tipo di richiesta.
 */

import type { Route } from "./+types/api.push";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { sendPush } from "~/lib/push.server";

/** La forma che `PushSubscription.toJSON()` produce nel browser. */
type IncomingSubscription = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function readSubscription(
  value: unknown
): { endpoint: string; p256dh: string; auth: string } | null {
  const candidate = value as IncomingSubscription | null;
  const endpoint = candidate?.endpoint;
  const p256dh = candidate?.keys?.p256dh;
  const auth = candidate?.keys?.auth;

  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return null;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;

  return { endpoint, p256dh, auth };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  const body = (await request.json().catch(() => null)) as
    | { intent?: string; subscription?: unknown; endpoint?: unknown }
    | null;

  switch (body?.intent) {
    case "subscribe": {
      const subscription = readSubscription(body.subscription);
      if (!subscription) {
        return Response.json({ error: "invalid subscription" }, { status: 400 });
      }

      /* `upsert` sull'endpoint e non `create`: lo stesso browser che si
         riscrive dopo una rotazione delle chiavi manda lo stesso endpoint, e
         un vincolo violato qui si vedrebbe come un pulsante che non funziona.
         `userId` viene riscritto apposta: un computer condiviso in
         associazione passa di mano, e le notifiche devono seguire chi ha
         fatto l'accesso adesso, non chi c'era prima. */
      await db.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          ...subscription,
          userId: user.id,
          userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
        },
        update: {
          userId: user.id,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
        },
      });

      return Response.json({ ok: true });
    }

    case "unsubscribe": {
      if (typeof body.endpoint !== "string") {
        return Response.json({ error: "missing endpoint" }, { status: 400 });
      }

      // `deleteMany` e non `delete`: filtra anche per proprietario, e non
      // solleva se la riga non c'è più (il browser può aver già dimenticato).
      await db.pushSubscription.deleteMany({
        where: { endpoint: body.endpoint, userId: user.id },
      });

      return Response.json({ ok: true });
    }

    case "test": {
      /* Vale da sola metà del capitolo di verifica: senza, per sapere se le
         notifiche funzionano bisogna aspettare che qualcuno faccia una
         richiesta vera. */
      const sent = await sendPush(user.id, {
        title: "Fabula",
        body: "Le notifiche funzionano su questo dispositivo.",
        url: "/account",
        tag: "test",
      });

      return Response.json({ ok: sent > 0, sent });
    }

    default:
      return Response.json({ error: "unknown intent" }, { status: 400 });
  }
}
