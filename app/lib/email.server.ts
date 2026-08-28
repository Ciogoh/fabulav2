/**
 * Invio delle email.
 *
 * In produzione passa da Resend. In sviluppo, se manca la chiave, il messaggio
 * finisce **nel terminale** invece di essere spedito: così si può provare tutto
 * il percorso di accesso senza configurare niente e senza mandare posta vera
 * agli indirizzi di prova.
 *
 * Resend viene chiamato via `fetch` sulla loro API HTTP: è una richiesta sola e
 * non vale una dipendenza in più.
 */

type SendArgs = {
  to: string;
  subject: string;
  /** Corpo in testo semplice. Gli HTML arriveranno con i modelli veri. */
  text: string;
};

const ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, text }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      // In produzione questo è un guasto vero: senza email nessuno può entrare
      // e i promemoria di riconsegna non partono.
      throw new Error(
        "RESEND_API_KEY o EMAIL_FROM non impostate: le email non possono partire."
      );
    }

    console.log(
      `\n┌─ EMAIL (non spedita: manca RESEND_API_KEY)\n` +
        `│  A:       ${to}\n` +
        `│  Oggetto: ${subject}\n` +
        `│\n` +
        text
          .trim()
          .split("\n")
          .map((line) => `│  ${line}`)
          .join("\n") +
        `\n└─\n`
    );
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });

  if (!response.ok) {
    // Il corpo della risposta dice *perché* (dominio non verificato, chiave
    // scaduta…). Senza, si resta con un 403 muto.
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend ha rifiutato l'invio (${response.status}): ${detail}`
    );
  }
}

/**
 * Gli indirizzi **in più** a cui mandare le nuove richieste.
 *
 * Prima era la lista dei destinatari, punto. Adesso i destinatari veri sono
 * gli utenti con ruolo `ADMIN` letti dal database, ciascuno sul canale che ha
 * scelto (`notifications.server.ts`), e `ADMIN_EMAILS` resta solo per chi non
 * ha un account: la casella condivisa dell'associazione, il tesoriere che
 * vuole sapere e basta.
 *
 * Gli indirizzi che coincidono con quello di un admin registrato **vengono
 * scartati**, e non è un dettaglio: senza questo filtro chi ha scelto «solo
 * notifiche» continuerebbe a ricevere la posta dalla porta di servizio, che è
 * esattamente il problema che la preferenza doveva risolvere.
 *
 * Il confronto è insensibile alle maiuscole perché la parte a destra della
 * chiocciola lo è per definizione, e perché un indirizzo scritto a mano in un
 * `.env` non ha nessuna ragione di combaciare carattere per carattere con
 * quello che una persona ha usato per registrarsi.
 */
export function extraAdminEmails(registered: string[]): string[] {
  const known = new Set(registered.map((address) => address.trim().toLowerCase()));

  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
    .filter((address) => !known.has(address.toLowerCase()));
}
