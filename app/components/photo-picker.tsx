/**
 * Le foto di un oggetto: quelle che ci sono, e quelle che stai per aggiungere.
 *
 * Prima c'era un `<input type="file" multiple>` nudo. Il browser scriveva
 * «3 file selezionati» e finiva lì: non si vedeva **quali**, non si poteva
 * toglierne uno senza rifare la scelta da capo, e un file troppo grosso lo si
 * scopriva solo dopo il caricamento, quando il server lo scartava in silenzio.
 * Con cinque scatti da telefono da 4 MB voleva dire aspettare per scoprire di
 * aver sbagliato.
 *
 * Tre idee, in ordine di importanza:
 *
 * 1. **L'`<input>` resta la fonte della verità.** Le miniature non sono uno
 *    stato parallelo: a ogni modifica riscriviamo `input.files` con un
 *    `DataTransfer`, quindi ciò che si vede è esattamente ciò che parte. Il
 *    modulo resta un modulo normale, e senza JavaScript si comporta come prima.
 * 2. **Il controllo si fa qui, prima di spedire.** Misura e formati sono gli
 *    stessi numeri del server, presi da `lib/uploads.shared.ts`: un file
 *    scartato lo dice subito, col suo nome, invece di sparire per strada.
 * 3. **La prima foto è quella del catalogo.** `sortOrder` esisteva già ma non
 *    lo scriveva nessuno — tutte a zero, e la copertina era quella che
 *    capitava. Ora si vede quale è, e si può cambiarla.
 *
 * **I pulsanti sulle foto salvate non sono moduli**, ma pressioni che mandano
 * la richiesta da sole (`fetcher.submit`). Erano `<form>` veri, e un modulo
 * dentro a un altro non è HTML valido: il browser lo scarta durante la lettura
 * della pagina, e in un'applicazione che genera l'HTML sul server questo
 * significa una pagina che non combacia con quella che React si aspetta.
 * Perderli come moduli costa il funzionamento senza JavaScript su due pulsanti
 * di una schermata da amministratore — in cambio le foto stanno tutte nello
 * stesso posto, ed è anche più corretto: cancellare una foto non tocca più il
 * testo che stai scrivendo nella descrizione e non salva niente per sbaglio.
 */

import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigation } from "react-router";
import { useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import {
  ACCEPTED_IMAGE_ACCEPT,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "~/lib/uploads.shared";

export type ExistingPhoto = { id: string; url: string; thumbUrl: string };

/** Un file scelto, con l'indirizzo temporaneo per mostrarlo prima di spedirlo. */
type Pick = { key: string; file: File; preview: string };

/** Un file fermato qui, che al server non arriva proprio. */
type Rejected = { key: string; name: string; reason: TranslationKey };

const keyOf = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

function check(file: File): TranslationKey | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "assets.photoBadType";
  if (file.size > MAX_UPLOAD_BYTES) return "assets.photoTooBig";
  return null;
}

/* ------------------------------------------------- le foto che ci sono già */

/**
 * La sezione delle foto, intera: il titolo, quelle che ci sono e quelle che
 * stai aggiungendo. È l'unica cosa che le rotte importano.
 */
export function PhotoFields({ existing = [] }: { existing?: ExistingPhoto[] }) {
  const t = useT();

  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow">
        {t("assets.photos")}
      </span>
      <PhotoGallery photos={existing} />
      <PhotoPicker />
    </div>
  );
}

/** Sulla pagina «nuovo oggetto» resta vuota: non c'è ancora niente da mostrare. */
function PhotoGallery({ photos }: { photos: ExistingPhoto[] }) {
  const t = useT();
  if (photos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <ExistingTile key={photo.id} photo={photo} isCover={index === 0} />
        ))}
      </ul>
      <p className="font-mono text-2xs text-muted">{t("assets.photoCoverHint")}</p>
    </div>
  );
}

function ExistingTile({ photo, isCover }: { photo: ExistingPhoto; isCover: boolean }) {
  const t = useT();
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  const act = (intent: "setCover" | "deletePhoto") =>
    void fetcher.submit({ intent, photoId: photo.id }, { method: "post" });

  return (
    <li
      className={`relative h-28 w-28 overflow-hidden rounded border ${
        isCover ? "border-accent" : "border-rule"
      } ${busy ? "opacity-50" : ""}`}
    >
      <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />

      {isCover && (
        <span className="absolute left-0 top-0 bg-accent px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-on-accent">
          {t("assets.photoCover")}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex">
        {!isCover && (
          <TileButton
            type="button"
            disabled={busy}
            onClick={() => act("setCover")}
            label={t("assets.photoMakeCover")}
          />
        )}
        <TileButton
          type="button"
          disabled={busy}
          onClick={() => act("deletePhoto")}
          label={t("assets.removePhoto")}
        />
      </div>
    </li>
  );
}

/* --------------------------------------------- le foto che stai aggiungendo */

function PhotoPicker({ name = "photos" }: { name?: string }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [dragging, setDragging] = useState(false);

  /* Ciò che si vede dev'essere ciò che parte: `input.files` non si costruisce
     a mano, ma la lista di un `DataTransfer` sì, ed è assegnabile. */
  function apply(next: Pick[]) {
    const data = new DataTransfer();
    for (const pick of next) data.items.add(pick.file);
    if (inputRef.current) inputRef.current.files = data.files;
    setPicks(next);
  }

  function add(files: FileList | File[]) {
    const accepted: Pick[] = [];
    const refused: Rejected[] = [];

    for (const file of Array.from(files)) {
      const key = keyOf(file);
      // Lo stesso file scelto due volte è quasi sempre un doppio clic, non la
      // volontà di caricarlo due volte.
      if (picks.some((pick) => pick.key === key)) continue;

      const problem = check(file);
      if (problem) refused.push({ key, name: file.name, reason: problem });
      else accepted.push({ key, file, preview: URL.createObjectURL(file) });
    }

    apply([...picks, ...accepted]);
    setRejected(refused);
  }

  function drop(key: string) {
    const gone = picks.find((pick) => pick.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    apply(picks.filter((pick) => pick.key !== key));
  }

  /* A salvataggio finito le foto scelte sono diventate foto vere e stanno
     nella galleria qui sopra: lasciarle anche fra quelle in attesa vorrebbe
     dire mostrarle due volte. Guardiamo la navigazione che portava proprio
     questo campo, non una qualunque. */
  const navigation = useNavigation();
  const wasSending = useRef(false);
  const sending =
    navigation.state === "submitting" && Boolean(navigation.formData?.has(name));

  useEffect(() => {
    if (sending) {
      wasSending.current = true;
      return;
    }
    if (wasSending.current && navigation.state === "idle") {
      wasSending.current = false;
      for (const pick of picks) URL.revokeObjectURL(pick.preview);
      apply([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, navigation.state]);

  // Gli indirizzi temporanei vanno restituiti, o restano in memoria finché la
  // scheda del browser è aperta.
  useEffect(() => {
    return () => {
      for (const pick of picks) URL.revokeObjectURL(pick.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {picks.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {picks.map((pick) => (
            <li
              key={pick.key}
              className={`relative h-28 w-28 overflow-hidden rounded border border-dashed border-accent ${
                sending ? "animate-pulse" : ""
              }`}
            >
              <img src={pick.preview} alt="" className="h-full w-full object-cover" />
              {/* Tratteggio e cartellino: si deve capire a colpo d'occhio che
                  questa foto non c'è ancora e che se ne vai se ne va con te. */}
              <span className="absolute left-0 top-0 bg-accent px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-on-accent">
                {sending ? t("assets.photoUploading") : t("assets.photoPending")}
              </span>
              <div className="absolute inset-x-0 bottom-0 flex">
                <TileButton
                  type="button"
                  onClick={() => drop(pick.key)}
                  disabled={sending}
                  label={t("assets.photoDontUpload")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Il campo vero è **fratello** dell'etichetta e non figlio: `peer`
          funziona solo fra fratelli, ed è ciò che porta l'anello di fuoco
          della tastiera sul riquadro, che è l'unica cosa che si vede.
          `sr-only` e non `hidden`: nascosto del tutto uscirebbe dal modulo. */}
      <div>
        <input
          ref={inputRef}
          id={name}
          name={name}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          multiple
          onChange={(event) => add(event.target.files ?? [])}
          className="peer sr-only"
        />
        <label
          htmlFor={name}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length > 0) add(event.dataTransfer.files);
          }}
          className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed px-4 py-5 text-center text-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
            dragging
              ? "border-accent bg-accent-soft text-accent"
              : "border-rule text-muted hover:border-accent hover:text-accent"
          }`}
        >
          <span className="font-medium">
            {picks.length > 0 ? t("assets.photoAddMore") : t("assets.photoDrop")}
          </span>
          <span className="font-mono text-2xs text-muted">
            {t("assets.photoLimits")}
          </span>
        </label>
      </div>

      {rejected.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 rounded bg-out-bg px-3 py-2 text-sm text-out"
        >
          {rejected.map((item) => (
            <li key={item.key}>
              <span className="font-medium">{item.name}</span> — {t(item.reason)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Il pulsante che sta sopra a una miniatura.
 *
 * Velo nero fisso e non `bg-ink`: nel tema scuro `--ink` è chiaro, quindi la
 * scritta bianca finirebbe su un fondo quasi bianco. Sopra una foto il velo
 * scuro è giusto in tutti e due i temi.
 */
function TileButton({
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className="min-h-8 flex-1 bg-black/70 px-1 py-1 text-2xs uppercase tracking-wider text-white hover:bg-black/85 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
