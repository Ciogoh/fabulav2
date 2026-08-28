/**
 * Il proprio profilo: la foto, il nome e come ci si fa chiamare.
 *
 * Ci si arriva premendo il proprio nome nell'intestazione — il posto in cui
 * chiunque lo cerca per prima cosa.
 *
 * Tre decisioni:
 *
 * - **Nome e cognome separati.** `name` da solo diventava «m.rossi91» o «sa»,
 *   e un admin che deve consegnare un oggetto di persona non sa a chi lo sta
 *   dando. Restano obbligatori.
 * - **L'alias è facoltativo** ed è quello che si vede ovunque. Chi non lo
 *   mette continua a comparire col nome e cognome, come prima.
 * - **`name` resta allineato** a «nome cognome» a ogni salvataggio: è il campo
 *   che Better Auth pretende, e lo leggono le email di reimposta password.
 *
 * Due moduli separati e non uno solo: la foto viaggia come `multipart` e si
 * manda da sola appena la scegli, il resto è testo. Un modulo unico avrebbe
 * costretto a ricaricare l'immagine a ogni correzione di una virgola nel nome.
 *
 * **La foto si cambia premendo la foto** (`AvatarPicker`, in fondo al file).
 * Prima accanto all'avatar c'era un `<input type="file"` nudo: l'unica cosa
 * premibile era il «Scegli file» disegnato dal browser — testo grigio piccolo,
 * di un altro mondo rispetto al resto dell'interfaccia — mentre la foto, che è
 * ciò che tutti provano a premere, era un'immagine morta.
 */

import { useEffect, useRef, useState } from "react";
import { Form, useFetcher, useNavigation, useRevalidator } from "react-router";
import type { Route } from "./+types/account";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { deleteAvatarFile, saveAvatar } from "~/lib/uploads.server";
import {
  getOrCreateCalendarToken,
  regenerateCalendarToken,
} from "~/lib/calendar-token.server";
import {
  MAX_ALIAS,
  MAX_NAME_PART,
  MIN_NAME_PART,
  type Person,
} from "~/lib/person";
import { useT } from "~/i18n/use-t";
import { PageShell, PageTitle } from "~/components/page";
import { Button, buttonClass } from "~/components/button";
import { Select } from "~/components/select";
import { Avatar, PersonName } from "~/components/person";
import type { TranslationKey } from "~/i18n/dictionaries";
import {
  ACCEPTED_IMAGE_ACCEPT,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "~/lib/uploads.shared";
import type { NotifyChannel } from "~/generated/prisma/enums";
import { vapidPublicKey } from "~/lib/push.server";
import { deviceLabel } from "~/lib/push.shared";
import {
  currentEndpoint,
  disablePush,
  enablePush,
  pushPermission,
  testPush,
  type PushPermission,
} from "~/lib/push.client";
import { promptInstall, useInstallState } from "~/components/pwa";
import { useFormatDay } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "account.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  /* `notifyChannel` si legge qui e non da `CurrentUser`: questa è la
     schermata che lo **modifica**, non una che decide dove mandare qualcosa.
     Tenerlo fuori da `CurrentUser` è ciò che garantisce che l'unico posto a
     consultarlo per spedire resti `notifications.server.ts` — e quindi che
     il codice di accesso continui ad arrivare per email a chiunque. */
  const [settings, devices, calendarToken] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { notifyChannel: true },
    }),
    db.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, endpoint: true, userAgent: true, createdAt: true },
    }),
    // Creato pigramente qui: la prima volta che questa sezione del profilo
    // si apre, non prima.
    getOrCreateCalendarToken(user.id),
  ]);

  return {
    person: {
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      alias: user.alias,
      image: user.image,
    } satisfies Person,
    email: user.email,
    calendarUrl: `${new URL(request.url).origin}/cal/${calendarToken}.ics`,
    notifyChannel: settings.notifyChannel,
    devices: devices.map((device) => ({
      id: device.id,
      // Serve al browser per riconoscere **se stesso** nell'elenco. È il
      // proprio indirizzo e non quello di nessun altro: non esce niente da
      // qui che chi guarda non abbia già.
      endpoint: device.endpoint,
      label: deviceLabel(device.userAgent),
      createdAt: device.createdAt,
    })),
    /* `null` significa «su questa installazione le notifiche non esistono»:
       mancano le chiavi VAPID nel `.env`. Non è un guasto — tutti gli avvisi
       partono via email, come prima — ma la sezione non va mostrata, o
       offrirebbe un pulsante che non può funzionare. */
    vapidPublicKey: vapidPublicKey(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  // Prima riga, sempre: qui si scrive sul profilo di chi chiama, e l'unico
  // profilo che può toccare è il proprio — l'id non arriva mai dal modulo.
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "photo") {
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, error: "account.errorNoPhoto" as TranslationKey };
    }

    const saved = await saveAvatar(user.id, file);
    if (!saved.ok) {
      return {
        ok: false as const,
        error: (saved.error === "tooBig"
          ? "account.errorPhotoTooBig"
          : "account.errorPhotoType") as TranslationKey,
      };
    }

    // Prima si scrive il nuovo indirizzo, poi si cancella il vecchio file: al
    // contrario, un errore in mezzo lascerebbe una scheda che punta a un file
    // che non c'è più.
    await db.user.update({ where: { id: user.id }, data: { image: saved.url } });
    await deleteAvatarFile(user.image);

    return { ok: true as const };
  }

  if (intent === "removePhoto") {
    await db.user.update({ where: { id: user.id }, data: { image: null } });
    await deleteAvatarFile(user.image);
    return { ok: true as const };
  }

  if (intent === "notifyChannel") {
    const channel = String(form.get("channel") ?? "");
    if (channel !== "EMAIL" && channel !== "PUSH" && channel !== "BOTH") {
      return { ok: false as const, error: "account.notifyError" as TranslationKey };
    }

    await db.user.update({
      where: { id: user.id },
      data: { notifyChannel: channel satisfies NotifyChannel },
    });
    return { ok: true as const };
  }

  if (intent === "calendarRegenerate") {
    await regenerateCalendarToken(user.id);
    return { ok: true as const };
  }

  if (intent === "removeDevice") {
    /* `deleteMany` con `userId` e non `delete` per id: l'id arriva dal
       modulo, e conoscere quello di un'iscrizione altrui non deve bastare a
       spegnere le notifiche a un'altra persona. Stessa regola dell'azione in
       `api.push.tsx`. */
    await db.pushSubscription.deleteMany({
      where: { id: String(form.get("device") ?? ""), userId: user.id },
    });
    return { ok: true as const };
  }

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const alias = String(form.get("alias") ?? "").trim();

  if (firstName.length < MIN_NAME_PART || lastName.length < MIN_NAME_PART) {
    return { ok: false as const, error: "account.errorNameRequired" as TranslationKey };
  }

  const first = firstName.slice(0, MAX_NAME_PART);
  const last = lastName.slice(0, MAX_NAME_PART);

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: first,
      lastName: last,
      alias: alias ? alias.slice(0, MAX_ALIAS) : null,
      // `name` non è un doppione da tenere per pigrizia: è il campo di Better
      // Auth, e se non lo aggiorniamo la reimposta password continua a
      // salutare qualcuno col nome di due anni fa.
      name: `${first} ${last}`,
    },
  });

  return { ok: true as const };
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { person, email } = loaderData;
  const t = useT();
  const navigation = useNavigation();

  const savingProfile = navigation.state !== "idle";
  const profileError = actionData && !actionData.ok ? actionData.error : null;
  // Un modulo che non dice niente quando riesce sembra un modulo rotto: qui
  // il salvataggio non cambia pagina, quindi senza una riga di conferma
  // l'unico segnale sarebbe il nome che cambia là in cima.
  const profileSaved = actionData?.ok === true && !savingProfile;

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("account.heading")} intro={t("account.intro")} />

        {/* ------------------------------------------------------- foto */}
        <AvatarPicker person={person} />

        {/* ------------------------------------------------------- nome */}
        <Form method="post" className="mt-10 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <Field
              label={t("account.firstName")}
              name="firstName"
              defaultValue={person.firstName ?? ""}
              autoComplete="given-name"
              required
            />
            <Field
              label={t("account.lastName")}
              name="lastName"
              defaultValue={person.lastName ?? ""}
              autoComplete="family-name"
              required
            />
          </div>

          <Field
            label={t("account.alias")}
            name="alias"
            defaultValue={person.alias ?? ""}
            autoComplete="nickname"
            maxLength={MAX_ALIAS}
            hint={t("account.aliasHint")}
          />

          <p className="text-[0.8rem] text-muted">
            {t("account.preview")}{" "}
            <PersonName person={person} className="font-medium text-ink" />
          </p>

          {profileError && (
            <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
              {t(profileError)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingProfile}
              className={buttonClass("primary")}
            >
              {t("account.save")}
            </button>
            <p aria-live="polite" className="text-sm text-free">
              {profileSaved ? t("account.saved") : ""}
            </p>
          </div>
        </Form>

        {/* ----------------------------------------------- notifiche */}
        <NotificationSettings
          channel={loaderData.notifyChannel}
          devices={loaderData.devices}
          vapidPublicKey={loaderData.vapidPublicKey}
        />

        {/* --------------------------------------- calendario personale */}
        <CalendarSection url={loaderData.calendarUrl} />

        {/* L'indirizzo non si cambia da qui: è l'identità con cui si entra, e
            spostarla vuol dire un codice di conferma sul nuovo indirizzo —
            un pezzo che oggi non c'è. Meglio dirlo che lasciare un campo
            che non funziona. */}
        <p className="mt-10 border-t border-rule pt-5 text-sm text-muted">
          {t("account.email")}: <span className="text-ink">{email}</span>
          <br />
          <span className="text-[0.8rem]">{t("account.emailHint")}</span>
        </p>
      </PageShell>
    </main>
  );
}

/* -------------------------------------------------------------- la foto */

/** Un solo campo per tutta la pagina: due etichette lo puntano, la foto e il
 * pulsante accanto. */
const PHOTO_INPUT_ID = "avatarPhoto";

/** Gli stessi limiti del server (`lib/uploads.shared.ts`): un file oltre
 * misura o di formato sbagliato lo si dice **prima** di caricarlo, che da un
 * telefono in 3G è la differenza fra un secondo e un minuto buttato. Le chiavi
 * d'errore sono quelle che risponderebbe l'action, così il messaggio è lo
 * stesso da qualunque parte arrivi. */
function checkPhoto(file: File): TranslationKey | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "account.errorPhotoType";
  if (file.size > MAX_UPLOAD_BYTES) return "account.errorPhotoTooBig";
  return null;
}

/**
 * La foto del profilo: mostrarla e cambiarla sono la stessa cosa.
 *
 * Il campo vero è `sr-only` e non `hidden` — nascosto del tutto uscirebbe dal
 * modulo e non lo raggiungerebbe più nemmeno la tastiera. Sta come **fratello**
 * dell'etichetta perché `peer` funziona solo fra fratelli: è così che l'anello
 * di fuoco della tastiera finisce sul cerchio, che è l'unica cosa che si vede.
 * È lo stesso impianto di `components/photo-picker.tsx`, qui su un tondo.
 *
 * **Il bollino della fotocamera si vede sempre**, non solo al passaggio del
 * mouse: su un telefono l'hover non esiste, e un invito che compare solo col
 * mouse è di nuovo un invito invisibile — cioè il difetto da cui siamo
 * partiti. Il velo con la scritta è in più, per chi il mouse ce l'ha.
 *
 * Il pulsante «Cambia foto» accanto non è un doppione: la foto premibile la
 * scopre chi ci prova, il pulsante la dice a chi legge.
 *
 * `aria-label` sul campo e non le etichette a dargli il nome: sono due, e chi
 * usa un lettore di schermo si sentirebbe annunciare due volte la stessa cosa.
 */
function AvatarPicker({ person }: { person: Person }) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<TranslationKey | null>(null);

  const uploading = fetcher.state !== "idle";
  const serverError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const error = localError ?? serverError;
  const label = person.image ? t("account.photoChange") : t("account.photoAdd");

  /* L'anteprima locale: la foto scelta si vede subito, senza aspettare il
     viaggio fino al server e il ritaglio. L'indirizzo temporaneo va restituito
     a mano, o resta in memoria finché la scheda è aperta — per questo passa
     tutto di qui. */
  const previewRef = useRef<string | null>(null);
  function showPreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreview(next);
  }

  /* A caricamento finito l'anteprima ha esaurito il suo compito: se è andata
     bene la foto vera è già arrivata col loader rivalidato, se è andata male
     si torna a quella di prima e l'errore dice perché. Il `ref` serve a non
     buttarla nel primo giro, quando il fetcher non si è ancora mosso. */
  const wasUploading = useRef(false);
  useEffect(() => {
    if (uploading) {
      wasUploading.current = true;
      return;
    }
    if (!wasUploading.current) return;
    wasUploading.current = false;
    showPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const problem = checkPhoto(file);
    if (problem) {
      setLocalError(problem);
      showPreview(null);
      // Svuotare il campo è ciò che permette di riscegliere lo stesso file
      // dopo averlo rimpicciolito: senza, il browser non manda un secondo
      // evento perché la scelta non è cambiata.
      input.value = "";
      return;
    }

    setLocalError(null);
    showPreview(URL.createObjectURL(file));
    // Si manda da sé appena scegli il file: un pulsante «carica» in più
    // sarebbe un passaggio che nessuno si aspetta.
    if (input.form) fetcher.submit(input.form);
  }

  return (
    <section className="mt-8 flex flex-col gap-3">
      <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
        {t("account.photo")}
      </span>

      <div className="flex flex-wrap items-center gap-5">
        <fetcher.Form method="post" encType="multipart/form-data">
          <input type="hidden" name="intent" value="photo" />
          <input
            id={PHOTO_INPUT_ID}
            name="photo"
            type="file"
            accept={ACCEPTED_IMAGE_ACCEPT}
            aria-label={label}
            disabled={uploading}
            onChange={choose}
            className="peer sr-only"
          />
          <label
            htmlFor={PHOTO_INPUT_ID}
            className={`group relative block rounded-full border-2 p-1 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
              uploading ? "cursor-wait" : "cursor-pointer"
            } ${
              person.image || preview
                ? "border-transparent hover:border-accent"
                : "border-dashed border-rule hover:border-accent"
            }`}
          >
            {preview ? (
              // Il ritaglio quadrato lo fa `object-cover`, lo stesso di
              // `<Avatar>`: l'anteprima non deve promettere un'inquadratura
              // diversa da quella che salverà il server.
              <img
                src={preview}
                alt=""
                className="h-24 w-24 shrink-0 rounded-full border border-rule bg-sunk object-cover"
              />
            ) : (
              <Avatar person={person} size="lg" alt={t("account.photoAlt")} />
            )}

            {/* Velo scuro fisso e non `bg-ink`: nel tema scuro `--ink` è
                chiaro, e la scritta bianca finirebbe su un fondo quasi
                bianco. Sopra una foto il nero va bene in tutti e due i temi. */}
            {uploading ? (
              <span className="absolute inset-1 flex animate-pulse items-center justify-center rounded-full bg-black/70 px-2 text-center font-mono text-[0.6rem] uppercase tracking-wider text-white">
                {t("account.uploading")}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-full bg-black/60 px-2 text-center font-mono text-[0.6rem] uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                {label}
              </span>
            )}

            <span
              aria-hidden="true"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-rule bg-card text-muted transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M3 8.5h3.5L8 6h8l1.5 2.5H21v11H3z" />
                <circle cx="12" cy="13.5" r="3.2" />
              </svg>
            </span>
          </label>
        </fetcher.Form>

        <div className="flex flex-col items-start gap-2">
          {/* Un'etichetta non si può spegnere come un pulsante: mentre carica
              la si toglie dal passaggio del mouse a mano. */}
          <label
            htmlFor={PHOTO_INPUT_ID}
            className={buttonClass(
              "secondary",
              "md",
              uploading ? "pointer-events-none opacity-60" : "cursor-pointer"
            )}
          >
            {label}
          </label>

          <p className="text-[0.8rem] text-muted">{t("account.photoHint")}</p>

          {person.image && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="removePhoto" />
              <Button type="submit" variant="danger" size="sm" disabled={uploading}>
                {t("account.removePhoto")}
              </Button>
            </fetcher.Form>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
          {t(error)}
        </p>
      )}

      {/* Il velo sulla foto lo vede chi guarda; questa riga è per chi non
          guarda, e resta nel documento anche da ferma o non verrebbe
          annunciata quando si riempie. */}
      <p aria-live="polite" className="sr-only">
        {uploading ? t("account.uploading") : ""}
      </p>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  autoComplete,
  required,
  hint,
  maxLength = MAX_NAME_PART,
}: {
  label: string;
  name: string;
  defaultValue: string;
  autoComplete: string;
  required?: boolean;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        className="min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"
      />
      {hint && <span className="text-[0.8rem] text-muted">{hint}</span>}
    </div>
  );
}

/* ------------------------------------------------ il calendario personale */

/**
 * Il collegamento privato con solo i propri prestiti, da incollare in Google
 * Calendar, Calendario di Apple o Outlook.
 *
 * **È una credenziale**, non un indirizzo qualsiasi: chi ce l'ha vede i
 * prestiti di questa persona, posizioni comprese, senza fare l'accesso. Da
 * qui il pulsante «Rigenera» invece di «Revoca»: sul profilo la sezione è
 * sempre aperta, quindi un token tolto ne farebbe nascere subito un altro —
 * dire la verità su cosa succede davvero è più chiaro che fingere una revoca
 * che lascerebbe comunque un collegamento valido in vista un istante dopo.
 */
function CalendarSection({ url }: { url: string }) {
  const t = useT();
  const fetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Niente permesso o niente API: la casella resta lì, selezionabile a
      // mano, che è il ripiego che funziona ovunque.
      inputRef.current?.select();
    }
  }

  return (
    <section className="mt-10 border-t border-rule pt-8">
      <h2 className="font-serif text-xl font-semibold">
        {t("account.calendarHeading")}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        {t("account.calendarIntro")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={t("account.calendarUrlLabel")}
          className="min-h-11 min-w-0 flex-1 rounded border border-rule bg-sunk px-3 py-2 font-mono text-[0.8rem] text-muted"
        />
        <Button variant="secondary" onClick={copy}>
          {copied ? t("account.calendarCopied") : t("account.calendarCopy")}
        </Button>
      </div>

      <p className="mt-3 max-w-prose text-[0.8rem] text-muted">
        {t("account.calendarHint")}
      </p>

      <fetcher.Form method="post" className="mt-4">
        <input type="hidden" name="intent" value="calendarRegenerate" />
        <Button
          type="submit"
          variant="danger"
          size="sm"
          disabled={fetcher.state !== "idle"}
          onClick={(event) => {
            if (!window.confirm(t("account.calendarRegenerateConfirm"))) {
              event.preventDefault();
            }
          }}
        >
          {t("account.calendarRegenerate")}
        </Button>
      </fetcher.Form>
    </section>
  );
}

/* ---------------------------------------------------------- le notifiche */

/**
 * Dove ricevere gli avvisi di prestito, e su quali dispositivi.
 *
 * Due cose diverse nella stessa sezione, ed è la distinzione che l'intera
 * schermata deve far capire:
 *
 *   **la preferenza è della persona** — email, notifiche, o entrambe;
 *   **l'iscrizione è del dispositivo** — il telefono e il portatile sono due
 *   righe, e si accendono uno per uno.
 *
 * Chi non le distingue accende le notifiche sul portatile, esce dall'ufficio
 * e conclude che non funzionano.
 *
 * Il permesso ha tre stati e vanno detti tutti e tre, perché il terzo è una
 * strada senza ritorno: **negato una volta, dal sito non si può più
 * chiedere**. La finestra non compare nemmeno, e senza una riga che spieghi
 * dove andare nelle impostazioni del sistema la persona preme un pulsante che
 * non fa niente e conclude che è rotto.
 *
 * Su iPhone c'è un vincolo in più e viene prima di tutto: le notifiche web
 * esistono solo se Fabula è stata **aggiunta alla schermata Home**. Non è una
 * preferenza fra le altre, è il prerequisito — ed è la ragione per cui
 * l'invito a installare vive qui dentro e non in una barra che galleggia.
 */
function NotificationSettings({
  channel,
  devices,
  vapidPublicKey,
}: {
  channel: NotifyChannel;
  devices: { id: string; endpoint: string; label: string | null; createdAt: string | Date }[];
  vapidPublicKey: string | null;
}) {
  const t = useT();
  const formatDay = useFormatDay();
  const channelFetcher = useFetcher();
  const revalidator = useRevalidator();
  const install = useInstallState();

  /* Tutto quello che segue si può sapere solo nel browser, quindi parte da
     «non lo so» e si riempie dopo il primo render: leggerlo durante il render
     sul server significherebbe disegnare la sezione due volte in due modi
     diversi e vederla sfarfallare all'idratazione. */
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);

  useEffect(() => {
    setPermission(pushPermission());
    void currentEndpoint().then(setThisEndpoint);
    // Rileggere dopo ogni cambiamento dell'elenco: chi toglie l'iscrizione di
    // questo dispositivo deve vedere ricomparire il pulsante «attiva».
  }, [devices]);

  // La preferenza si salva da sola al cambio, come il selettore della lingua
  // nell'intestazione: un menu a tendina con accanto un pulsante «Salva» per
  // un campo solo è una cerimonia che nessuno completa.
  const savedChannel = channelFetcher.data !== undefined && channelFetcher.state === "idle";

  const subscribedHere = thisEndpoint !== null && devices.some((d) => d.endpoint === thisEndpoint);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setNotice(null);

    const result = await enablePush(vapidPublicKey);
    setPermission(pushPermission());
    setBusy(false);

    if (result.ok) {
      setThisEndpoint(result.endpoint);
      // L'elenco dei dispositivi vive nel loader: senza questo, la riga nuova
      // comparirebbe solo alla prossima visita.
      void revalidator.revalidate();
      return;
    }

    setNotice(
      result.reason === "denied"
        ? "account.notifyDenied"
        : result.reason === "unsupported"
          ? "account.notifyUnsupported"
          : "account.notifyError"
    );
  }

  async function removeThisDevice() {
    setBusy(true);
    await disablePush();
    setThisEndpoint(null);
    setBusy(false);
    void revalidator.revalidate();
  }

  async function sendTest() {
    setBusy(true);
    setNotice(null);
    const ok = await testPush();
    setBusy(false);
    setNotice(ok ? "account.notifyTestSent" : "account.notifyTestFailed");
  }

  /* Senza chiavi VAPID le notifiche non esistono su questa installazione:
     mostrare il menu a tendina significherebbe offrire una scelta di cui due
     valori su tre non fanno niente. */
  if (!vapidPublicKey) return null;

  return (
    <section className="mt-10 border-t border-rule pt-8">
      <h2 className="font-serif text-xl font-semibold">{t("account.notifyHeading")}</h2>
      <p className="mt-2 text-sm text-muted">{t("account.notifyIntro")}</p>

      {/* ------------------------------------------------ la preferenza */}
      <channelFetcher.Form method="post" className="mt-6 max-w-xs">
        <input type="hidden" name="intent" value="notifyChannel" />
        <label
          htmlFor="notifyChannel"
          className="font-mono text-[0.68rem] uppercase tracking-widest text-muted"
        >
          {t("account.notifyChannel")}
        </label>
        <div className="mt-1.5">
          <Select
            id="notifyChannel"
            name="channel"
            defaultValue={channel}
            onChange={(event) => channelFetcher.submit(event.currentTarget.form)}
          >
            <option value="EMAIL">{t("account.notifyChannelEmail")}</option>
            <option value="PUSH">{t("account.notifyChannelPush")}</option>
            <option value="BOTH">{t("account.notifyChannelBoth")}</option>
          </Select>
        </div>
        <p aria-live="polite" className="mt-1.5 text-[0.8rem] text-free">
          {savedChannel ? t("account.saved") : ""}
        </p>
      </channelFetcher.Form>

      {/* La riga che vale metà della schermata: senza, chi sceglie «solo
          notifiche» ha ragione di temere di non ricevere più il codice per
          entrare. */}
      <p className="mt-3 max-w-prose text-[0.8rem] text-muted">
        {t("account.notifyChannelHint")}
      </p>

      {/* ------------------------------------------------ i dispositivi */}
      <h3 className="mt-8 font-mono text-[0.68rem] uppercase tracking-widest text-muted">
        {t("account.notifyDevices")}
      </h3>

      {devices.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("account.notifyNoDevices")}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-rule border-y border-rule">
          {devices.map((device) => {
            const isThisOne = device.endpoint === thisEndpoint;

            return (
              <li key={device.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="text-sm">
                  {device.label ?? t("account.notifyUnknownDevice")}
                  {isThisOne && (
                    <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[0.7rem] text-accent">
                      {t("account.notifyThisDevice")}
                    </span>
                  )}
                </span>
                <span className="text-[0.8rem] text-muted">
                  {t("account.notifyAdded", { date: formatDay(device.createdAt) })}
                </span>

                <span className="ml-auto">
                  {isThisOne ? (
                    /* Su questo dispositivo non basta cancellare la riga: va
                       disdetta anche l'iscrizione dentro al browser, o il
                       servizio push continuerebbe a considerarla viva e il
                       pulsante «attiva» ritroverebbe la vecchia. */
                    <Button variant="danger" size="sm" onClick={removeThisDevice} disabled={busy}>
                      {t("account.notifyRemove")}
                    </Button>
                  ) : (
                    <RemoveDeviceButton id={device.id} label={t("account.notifyRemove")} />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------------- le azioni */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!subscribedHere && permission !== "denied" && permission !== "unsupported" && (
          /* Il permesso si può chiedere **solo** da un gesto vero della
             persona: è un requisito dei browser, non una scelta di stile.
             Chiederlo al caricamento della pagina lo fa negare a tutti. */
          <Button variant="primary" onClick={enable} disabled={busy}>
            {t("account.notifyEnable")}
          </Button>
        )}

        {subscribedHere && (
          <Button variant="secondary" onClick={sendTest} disabled={busy}>
            {t("account.notifyTest")}
          </Button>
        )}
      </div>

      {permission === "denied" && (
        <p className="mt-4 max-w-prose rounded bg-sunk px-3 py-2 text-sm text-muted">
          {t("account.notifyDenied")}
        </p>
      )}

      {permission === "unsupported" && !install.isIos && (
        <p className="mt-4 max-w-prose text-sm text-muted">{t("account.notifyUnsupported")}</p>
      )}

      {notice && permission !== "denied" && (
        <p aria-live="polite" className="mt-4 text-sm text-muted">
          {t(notice)}
        </p>
      )}

      {/* ------------------------------------------- installare l'app */}
      <InstallInvitation state={install} />
    </section>
  );
}

/** Togliere un dispositivo che non è questo: solo la riga nel database, perché
 * l'iscrizione dentro a quel browser la può disdire solo quel browser. Smette
 * comunque di ricevere: è il server a non avere più il suo indirizzo. */
function RemoveDeviceButton({ id, label }: { id: string; label: string }) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="removeDevice" />
      <input type="hidden" name="device" value={id} />
      <Button type="submit" variant="danger" size="sm" disabled={fetcher.state !== "idle"}>
        {label}
      </Button>
    </fetcher.Form>
  );
}

/**
 * «Installa Fabula», due strade completamente diverse.
 *
 * Android e i desktop mandano un evento (`beforeinstallprompt`) e si può
 * mostrare un pulsante vero. iOS non lo manda e non lo manderà: lì l'unica
 * strada sono le istruzioni scritte — Condividi, poi Aggiungi alla schermata
 * Home — e vanno mostrate **solo** su iOS e **solo** se non è già installata,
 * o si finisce col dare istruzioni per una cosa già fatta.
 */
function InstallInvitation({ state }: { state: ReturnType<typeof useInstallState> }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);

  if (state.isInstalled || hidden) return null;

  if (state.isIos) {
    return (
      <div className="mt-6 rounded border border-rule bg-sunk p-4">
        <p className="text-sm font-medium">{t("account.installHeading")}</p>
        {/* Su iPhone questa non è una comodità: senza l'icona sulla schermata
            Home, le notifiche web non arrivano affatto. È un vincolo di
            Apple, e va detto qui o la persona attiva le notifiche e aspetta
            per sempre. */}
        <p className="mt-1.5 text-[0.8rem] text-muted">{t("account.installIosWhy")}</p>
        <p className="mt-2 text-sm">{t("account.installIosHow")}</p>
        <Button variant="plain" size="sm" className="mt-2" onClick={() => setHidden(true)}>
          {t("account.installDismiss")}
        </Button>
      </div>
    );
  }

  if (!state.canPrompt) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded border border-rule bg-sunk p-4">
      <p className="text-sm">{t("account.installHeading")}</p>
      <Button
        variant="secondary"
        size="sm"
        className="ml-auto"
        onClick={async () => {
          const outcome = await promptInstall();
          if (outcome !== "unavailable") setHidden(true);
        }}
      >
        {t("account.installButton")}
      </Button>
    </div>
  );
}
