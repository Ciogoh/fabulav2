/**
 * La conferma prima di un'azione che non si torna indietro.
 *
 * Fino a ieri erano otto `window.confirm()`, e per Fabula sono un corpo
 * estraneo in tre modi che si sommano:
 *
 * 1. **Non parlano la nostra lingua.** Il testo della domanda è tradotto, i
 *    due pulsanti no: sono «OK» e «Annulla» del sistema operativo, nella
 *    lingua del sistema operativo. Un socio di lingua tedesca che ha messo
 *    Fabula in tedesco si vedeva la domanda in tedesco e i pulsanti in
 *    italiano.
 * 2. **Non dicono cosa stanno per fare.** «OK» va bene per qualunque cosa, ed
 *    è il difetto peggiore proprio dove serve di più: il pulsante che
 *    cancella un oggetto e quello che manda un promemoria hanno la stessa
 *    scritta. Qui il pulsante di conferma **porta il verbo dell'azione** —
 *    «Elimina», «Archivia» — e la variante `danger` quando distrugge qualcosa.
 * 3. **Bloccano il processo.** `confirm()` ferma il thread: niente animazione,
 *    niente contorno di fuoco, e su iOS in modalità app installata la
 *    finestra di sistema arriva con l'intestazione del browser che nel resto
 *    dell'applicazione non c'è.
 *
 * E poi ce n'era uno **doppio** — due finestre di sistema in fila per mandare
 * un link di reimpostazione password. Due domande in fila non fanno leggere
 * di più: fanno premere «OK» due volte senza guardare. Sono diventate una
 * domanda con sotto la conseguenza scritta, che è ciò che la seconda finestra
 * provava a dire.
 *
 * ## Come si usa
 *
 * Il modulo resta esattamente quello di prima — stessa `<Form>`, stessi campi
 * nascosti, stesso `action`: cambia solo chi decide se l'invio parte.
 *
 * ```tsx
 * const confirm = useConfirm();
 * ...
 * <Form method="post" onSubmit={confirm.ask({
 *   title: t("assets.confirmDelete"),
 *   confirmLabel: t("assets.delete"),
 *   tone: "danger",
 * })}>
 *   ...
 * </Form>
 * {confirm.dialog}
 * ```
 *
 * `ask` restituisce un `onSubmit` che trattiene l'invio e apre il dialogo;
 * alla conferma rimanda l'invio allo stesso modulo con `requestSubmit`,
 * **passando il pulsante che l'aveva scatenato** — senza, un modulo che
 * distingue le azioni dal `name`/`value` del pulsante premuto perderebbe
 * quel dato per strada. Funziona identico con `<Form>` e con
 * `fetcher.Form`: l'evento nativo di invio è lo stesso, e React Router lo
 * intercetta lì.
 */

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "~/components/button";
import { Dialog } from "~/components/dialog";
import { useT } from "~/i18n/use-t";

export type ConfirmText = {
  /** La domanda. Corta, e in forma di domanda. */
  title: string;
  /** La conseguenza, quando non è ovvia dalla domanda. */
  body?: ReactNode;
  /** Il verbo dell'azione, mai «OK». */
  confirmLabel: string;
  tone?: "danger" | "primary";
};

export function useConfirm() {
  const [pending, setPending] = useState<{
    form: HTMLFormElement;
    submitter: HTMLElement | null;
    text: ConfirmText;
  } | null>(null);
  /* L'invio confermato deve passare senza riaprire il dialogo. Un `ref` e non
     uno stato: viene letto e azzerato dentro allo stesso giro di evento, e un
     `setState` qui arriverebbe dopo. */
  const confirmed = useRef(false);

  function ask(text: ConfirmText) {
    return (event: FormEvent<HTMLFormElement>) => {
      if (confirmed.current) {
        confirmed.current = false;
        return;
      }
      event.preventDefault();
      setPending({
        // Preso adesso: `currentTarget` di un evento di React è già `null`
        // quando il gestore ritorna.
        form: event.currentTarget,
        submitter: (event.nativeEvent as SubmitEvent).submitter,
        text,
      });
    };
  }

  const dialog = pending ? (
    <ConfirmDialog
      {...pending.text}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const { form, submitter } = pending;
        setPending(null);
        confirmed.current = true;
        form.requestSubmit(
          submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
            ? submitter
            : undefined
        );
      }}
    />
  ) : null;

  return { ask, dialog };
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = "danger",
  onCancel,
  onConfirm,
}: ConfirmText & { onCancel: () => void; onConfirm: () => void }) {
  const t = useT();
  const titleId = useId();
  const bodyId = useId();

  return (
    <Dialog
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={body ? bodyId : undefined}
      panelClassName="max-w-sm"
    >
      <h2 id={titleId} className="font-serif text-lg font-semibold">
        {title}
      </h2>
      {body && (
        <p id={bodyId} className="mt-2 text-sm text-muted">
          {body}
        </p>
      )}

      {/* «Annulla» a sinistra e l'azione a destra, come nel foglio della
          richiesta: due dialoghi che invertono i pulsanti sono il modo più
          rapido per far premere quello sbagliato a chi va a memoria. */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button variant="plain" onClick={onCancel}>
          {t("request.cancel")}
        </Button>
        <Button variant={tone === "danger" ? "destructive" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
