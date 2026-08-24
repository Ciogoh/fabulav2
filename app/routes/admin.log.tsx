/**
 * Il registro: chi ha fatto cosa, in ordine di tempo.
 *
 * Sola lettura, nessuna action — un registro che si può modificare non è un
 * registro. Non c'è nemmeno un modo di cancellare una riga dall'interfaccia:
 * se un giorno servisse una potatura delle voci vecchie, è un lavoro da fare
 * sul database, non un pulsante da dare a chi potrebbe volerne nascondere una.
 *
 * Le ultime `LIMIT` voci e basta, senza paginazione: per un'associazione di
 * volontari il volume è basso, e una paginazione costruita prima di servire è
 * codice da mantenere per niente. Quando il registro comincerà a essere
 * tagliato davvero, la riga in fondo alla pagina lo dice.
 */

import type { Route } from "./+types/admin.log";
import { PageShell } from "~/components/page";
import { pageTitle } from "~/i18n/meta";
import { Avatar, PersonName } from "~/components/person";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useLang, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import { versionLabel } from "~/lib/version";

const LIMIT = 100;

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "log.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const entries = await db.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      // Campo per campo, come ovunque: `include` porterebbe fuori anche
      // l'email e la password hash di chi ha agito.
      actor: {
        select: {
          name: true,
          firstName: true,
          lastName: true,
          alias: true,
          image: true,
        },
      },
    },
  });

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      detail: entry.detail,
      createdAt: entry.createdAt.toISOString(),
      actor: entry.actor,
    })),
    truncated: entries.length === LIMIT,
  };
}

/**
 * Le azioni di cui esiste un'etichetta tradotta.
 *
 * Il campo `action` sul database è una stringa libera per non dover migrare a
 * ogni azione nuova (vedi lo schema), quindi qui può arrivare una chiave che
 * l'interfaccia non conosce — una riga scritta da una versione più recente,
 * o da una che registrava qualcosa che poi è stato tolto. In quel caso si
 * mostra la chiave grezza invece di una riga vuota: brutta da leggere, ma il
 * registro continua a dire che qualcosa è successo.
 */
const KNOWN_ACTIONS = new Set([
  "request.approve",
  "request.reject",
  "request.cancel",
  "requestItem.pickup",
  "requestItem.return",
  "member.roleChanged",
  "member.resetSent",
  "asset.archived",
  "asset.deleted",
  "asset.handover",
]);

export default function AdminLog({ loaderData }: Route.ComponentProps) {
  const { entries, truncated } = loaderData;
  const t = useT();
  const lang = useLang();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("log.heading")}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">{t("log.intro")}</p>

        {entries.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("log.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col divide-y divide-rule border-t border-rule">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3 text-sm/7">
                {/* Una riga, una misura, una interlinea — e l'avatar alto
                    esattamente come lei.

                    `text-sm/7` dà 14px di testo su 28px di linea, cioè `h-7`,
                    che è l'altezza dell'avatar `sm`: con `items-start` i tre
                    pezzi partono dallo stesso bordo e la prima linea di testo
                    sta in mezzo alla stessa scatola in cui sta l'avatar.
                    Niente `pt-1` a occhio da ritoccare quando cambia una
                    misura, e niente `items-baseline`, che qui non funzionerebbe
                    comunque (vedi `PersonInline` in `components/person.tsx`).

                    La misura sta sulla riga e non sui pezzi: prima il nome era
                    l'unico a non avere `text-sm`, ereditava i 16px del
                    documento e restava più grande di tutto il resto. */}
                <Avatar person={entry.actor} size="sm" />

                {/* Chi, cosa e su cosa stanno in **un solo blocco di testo che
                    va a capo da solo**, non in tre riquadri affiancati. Erano
                    tre elementi di un `flex flex-wrap`: sotto ai 640px la riga
                    si spezzava in tre — nome e azione sfalsati, la data da
                    sola in fondo. Come testo in linea l'andata a capo cade fra
                    due parole e la riga resta una frase: «Tizio ha fatto
                    questo · su quello». */}
                <p className="min-w-0 flex-1">
                  <PersonName person={entry.actor} className="font-medium" />{" "}
                  {KNOWN_ACTIONS.has(entry.action)
                    ? t(`log.action.${entry.action}` as TranslationKey)
                    : entry.action}
                  {/* Il punto in mezzo e non un trattone: i dettagli si
                      scrivono già con « — » dentro («Giulia Ferrari — MEMBER →
                      ADMIN»), e due trattoni di fila non fanno più capire dove
                      finisce l'azione e comincia il dettaglio. */}
                  {entry.detail && (
                    <span className="text-muted"> · {entry.detail}</span>
                  )}
                </p>

                {/* L'orario in fondo e non in testa: la domanda è «chi ha
                    fatto cosa», e la data serve solo dopo aver trovato la
                    riga giusta. Il `/7` è la stessa interlinea della riga,
                    ripetuta perché una misura scritta a mano si porta dietro
                    la sua: senza, l'orario tornerebbe a galleggiare mezzo
                    carattere più in alto dell'azione. */}
                <time
                  dateTime={entry.createdAt}
                  className="shrink-0 font-mono text-[0.7rem]/7 text-muted"
                >
                  {new Date(entry.createdAt).toLocaleString(lang, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}

        {truncated && (
          <p className="mt-6 text-sm text-muted">{t("log.truncated", { count: LIMIT })}</p>
        )}

        {/* Che copia di Fabula sta girando. Sta qui perché questa è già la
            pagina del «cosa è successo», e perché la domanda arriva sempre
            insieme a un'altra: «ma il server ha già la correzione?».
            Senza etichetta: «Versione:» andrebbe tradotto in tre lingue per
            non dire niente in più. Vedi `lib/version.ts`. */}
        <p className="mt-10 border-t border-rule pt-4 font-mono text-[0.7rem] text-muted">
          {versionLabel()}
        </p>
      </PageShell>
    </main>
  );
}
