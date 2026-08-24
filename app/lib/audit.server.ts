/**
 * Il registro delle azioni degli admin.
 *
 * Una funzione sola, chiamata dalle action dopo che il lavoro vero è
 * riuscito. Registra solo ciò che sposta qualcosa di irreversibile o che
 * riguarda un'altra persona: decisioni su una richiesta, passaggi di mano,
 * ruoli, reset di password, archiviazione di un oggetto. Le modifiche di
 * campo (un nome, una descrizione) restano fuori — vedi il commento su
 * `AdminAction` nello schema.
 *
 * **Un registro che non parte non deve far fallire l'azione registrata.**
 * Stesso principio delle email in `notifications.server.ts`: chi ha appena
 * approvato una richiesta l'ha approvata, a prescindere da cosa succede alla
 * riga di cronologia. Qui però l'errore viene inghiottito *dentro*, e non
 * lasciato risalire come per le email: nessuno di chi chiama avrebbe qualcosa
 * di sensato da fare con un log fallito, e obbligarli tutti a un `try/catch`
 * intorno significherebbe solo dimenticarsene una volta e far esplodere
 * un'approvazione per colpa della sua cronologia.
 */

import { db } from "~/lib/db.server";

/**
 * Le azioni registrabili. È un'unione di stringhe e non un enum del database:
 * il registro è cronologia, e un enum costringerebbe a una migrazione ogni
 * volta che se ne aggiunge una. I tipi la tengono comunque chiusa qui, così
 * una chiave scritta male non arriva a destinazione — e ogni valore ha la sua
 * etichetta tradotta in `dictionaries.ts` sotto `log.action.*`.
 */
export type AdminActionKind =
  | "request.approve"
  | "request.reject"
  | "request.cancel"
  | "requestItem.pickup"
  | "requestItem.return"
  | "member.roleChanged"
  | "member.resetSent"
  | "asset.archived"
  | "asset.deleted"
  | "asset.handover";

export async function logAdminAction(params: {
  actorId: string;
  action: AdminActionKind;
  targetType: "Request" | "RequestItem" | "User" | "Asset";
  targetId: string;
  detail?: string;
}): Promise<void> {
  try {
    await db.adminAction.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        // Una riga di registro lunga un romanzo non serve a nessuno, e il
        // testo qui dentro nasce da nomi di oggetti che un admin può fare
        // arbitrariamente lunghi.
        detail: params.detail?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error("Registrazione dell'azione admin fallita:", error);
  }
}
