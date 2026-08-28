/**
 * Generazione del calendario in formato iCalendar (RFC 5545).
 *
 * Serve a incollare un indirizzo dentro a Google Calendar, Apple Calendario o
 * Outlook e vedersi comparire le occupazioni degli oggetti.
 *
 * L'unico che lo usa è il calendario personale
 * (`routes/cal.$token[.]ics.tsx`), uno per persona: c'è di proposito
 * **nessuna esportazione globale**, o il collegamento di chiunque
 * racconterebbe a chiunque altro le occupazioni di tutti. `buildCalendar`
 * resta comunque generico — non sa niente di token o di persone, riceve solo
 * ciò che il chiamante gli passa — e non deve mai ricevere il nome di una
 * persona diversa dal proprietario del calendario.
 */

const PRODID = "-//Material Matters//Fabula//IT";

/** Un'occupazione da mostrare nel calendario. */
export type CalendarEntry = {
  /** Identificatore stabile: se cambia, il programma crea un doppione. */
  uid: string;
  assetName: string;
  /** Primo giorno del prestito, incluso. */
  startDate: Date;
  /** Ultimo giorno del prestito, incluso. */
  endDate: Date;
  /** Se l'oggetto è già stato ritirato. */
  pickedUp: boolean;
  /** Dove ritirarlo e riportarlo. Solo il calendario personale la usa: quello
   * pubblico non deve mai dire dov'è un oggetto (vedi Sicurezza in
   * CLAUDE.md). */
  location?: string | null;
  /** La richiesta è ancora da approvare: l'evento nasce provvisorio. */
  pending?: boolean;
  /** Sovrascrive la riga generata da `pickedUp` — il calendario personale
   * l'aggiunge per mettere il periodo e il collegamento alla richiesta. */
  description?: string;
  /** Aggiunge un avviso il giorno prima della scadenza. */
  returnReminder?: boolean;
};

export function buildCalendar(
  entries: CalendarEntry[],
  { name, description }: { name: string; description: string }
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(description)}`,
    // Suggerisce ai programmi ogni quanto riscaricare. Non è vincolante, ma
    // senza, alcuni aggiornano una volta al giorno e mostrano dati vecchi.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const stamp = toUtcStamp(new Date());

  for (const entry of entries) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.uid}@fabula`,
      `DTSTAMP:${stamp}`,
      // Eventi di giornata intera. In iCalendar DTEND è **esclusivo**: per un
      // prestito che finisce il 7 va scritto l'8, altrimenti il calendario
      // mostra un giorno in meno e la gente riporta le cose in ritardo.
      `DTSTART;VALUE=DATE:${toDateValue(entry.startDate)}`,
      `DTEND;VALUE=DATE:${toDateValue(addDays(entry.endDate, 1))}`,
      `SUMMARY:${escapeText(entry.assetName)}`,
      `DESCRIPTION:${escapeText(
        entry.description ?? (entry.pickedUp ? "In uso." : "Prenotato.")
      )}`,
      `STATUS:${entry.pending ? "TENTATIVE" : "CONFIRMED"}`,
      "TRANSP:OPAQUE"
    );

    if (entry.location) lines.push(`LOCATION:${escapeText(entry.location)}`);

    // Un giorno prima della scadenza, non prima dell'inizio: per un prestito
    // di un solo giorno l'avviso cadrebbe prima ancora del ritiro, quindi si
    // salta piuttosto che avvisare troppo presto.
    if (entry.returnReminder) {
      const alarmDay = addDays(entry.endDate, -1);
      if (alarmDay.getTime() >= entry.startDate.getTime()) {
        const alarmAt = new Date(
          Date.UTC(
            alarmDay.getUTCFullYear(),
            alarmDay.getUTCMonth(),
            alarmDay.getUTCDate(),
            8
          )
        );
        lines.push(
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          "DESCRIPTION:Da restituire domani.",
          `TRIGGER;VALUE=DATE-TIME:${toUtcStamp(alarmAt)}`,
          "END:VALARM"
        );
      }
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 vuole terminatori CRLF e righe non più lunghe di 75 ottetti.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------- utilità */

function addDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days
    )
  );
}

/** `20260827` */
function toDateValue(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** `20260827T101500Z` */
function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Virgole, punti e virgola e barre rovesciate hanno un significato nel
 * formato: un nome come «Cavo XLR 10 m; nero» spezzerebbe l'evento in due
 * proprietà. Le interruzioni di riga diventano `\n` letterali.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Piega le righe lunghe secondo la specifica: si spezza a 75 **ottetti** (non
 * caratteri) e si riprende con uno spazio. Il conteggio è in byte perché una
 * lettera accentata ne occupa due, e tagliare a metà di un carattere produce
 * un file che i calendari rifiutano.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // Prima riga 75 ottetti, quelle dopo 74 (uno se ne va nello spazio).
    const limit = chunks.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);

    // Arretra finché non si è su un confine di carattere valido.
    while (end > start && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
      end--;
    }

    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return chunks.join("\r\n ");
}
