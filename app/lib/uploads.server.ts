/**
 * Caricamento delle foto: quelle degli oggetti e quelle del profilo.
 *
 * Ogni foto diventa due JPEG — una "piena" e una miniatura — qualunque sia
 * il formato di partenza. Così la pagina serve sempre lo stesso
 * content-type, e chi carica un HEIC da telefono o un PNG enorme non se ne
 * accorge nemmeno.
 *
 * `sharp(...).rotate()` senza argomenti applica l'orientamento scritto negli
 * EXIF e poi li toglie: oltre a raddrizzare le foto prese di lato, così non
 * escono dati di posizione dal telefono di chi le ha scattate.
 */

import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { isUploadedAvatar } from "~/lib/person";
import { MAX_UPLOAD_BYTES, MAX_TUTORIAL_VIDEO_BYTES } from "~/lib/uploads.shared";

export const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

const MAIN_MAX_DIMENSION = 1600;
const THUMB_MAX_DIMENSION = 480;
const JPEG_QUALITY = 82;

/** L'avatar si mostra al massimo a 96px, e su uno schermo a densità doppia
 * fanno 192: 512 basta e avanza, e resta una manciata di kilobyte. */
const AVATAR_SIZE = 512;

/**
 * Il tipo vero si legge dai primi byte, non dall'estensione — un `.jpg` può
 * contenere qualunque cosa. Copre gli unici tre formati che ci interessano;
 * tutto il resto (SVG compreso, che porterebbe rischio XSS) viene rifiutato.
 */
function looksLikeImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true; // PNG
  }
  return (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

export type UploadResult =
  | { ok: true; url: string; thumbUrl: string }
  | { ok: false; error: "tooBig" | "invalidType" };

export async function saveAssetPhoto(
  assetId: string,
  file: File
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooBig" };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buffer)) return { ok: false, error: "invalidType" };

  const dir = path.join(UPLOAD_ROOT, "assets", assetId);
  await mkdir(dir, { recursive: true });

  const fileId = randomUUID();
  const mainPath = path.join(dir, `${fileId}.jpg`);
  const thumbPath = path.join(dir, `${fileId}-thumb.jpg`);

  try {
    await sharp(buffer)
      .rotate()
      .resize({
        width: MAIN_MAX_DIMENSION,
        height: MAIN_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(mainPath);

    await sharp(buffer)
      .rotate()
      .resize({
        width: THUMB_MAX_DIMENSION,
        height: THUMB_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(thumbPath);
  } catch {
    // Un file che ha superato il controllo sui byte magici ma è comunque
    // corrotto o troncato: sharp fa da seconda barriera.
    return { ok: false, error: "invalidType" };
  }

  return {
    ok: true,
    url: `/uploads/assets/${assetId}/${fileId}.jpg`,
    thumbUrl: `/uploads/assets/${assetId}/${fileId}-thumb.jpg`,
  };
}

/* ------------------------------------------------------ foto del profilo */

/**
 * L'avatar di una persona: **un file solo**, quadrato.
 *
 * Niente coppia piena + miniatura come per gli oggetti, perché un'avatar non
 * si guarda mai a schermo intero. `fit: "cover"` ritaglia al centro invece di
 * lasciare bande vuote: un ritratto verticale e uno panoramico devono stare
 * bene tutti e due nello stesso cerchietto da 28 pixel dell'intestazione.
 *
 * Il nome del file è casuale a ogni caricamento e non deriva mai da quello
 * mandato dal browser: un `../../` dentro `file.name` non ha modo di arrivare
 * fino a `path.join`.
 */
export async function saveAvatar(
  userId: string,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: "tooBig" | "invalidType" }> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooBig" };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buffer)) return { ok: false, error: "invalidType" };

  const dir = path.join(UPLOAD_ROOT, "avatars", userId);
  await mkdir(dir, { recursive: true });

  const fileId = randomUUID();
  const filePath = path.join(dir, `${fileId}.jpg`);

  try {
    await sharp(buffer)
      .rotate()
      .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover", position: "attention" })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(filePath);
  } catch {
    // Ha passato il controllo sui byte magici ma è comunque rotto o troncato:
    // sharp fa da seconda barriera, come per le foto degli oggetti.
    return { ok: false, error: "invalidType" };
  }

  return { ok: true, url: `/uploads/avatars/${userId}/${fileId}.jpg` };
}

/**
 * Toglie dal disco l'avatar precedente.
 *
 * **Solo le nostre.** Chi entra con Google ha in `image` un indirizzo
 * `https://lh3.googleusercontent.com/...`: passarlo di qui costruirebbe un
 * percorso senza senso, e in ogni caso quel file non è nostro da cancellare.
 */
export async function deleteAvatarFile(image: string | null): Promise<void> {
  if (!isUploadedAvatar(image)) return;
  await unlink(
    path.join(UPLOAD_ROOT, image!.replace(/^\/uploads\//, ""))
  ).catch(() => {});
}

/** Cancellazione best-effort: se i file non ci sono più, va bene lo stesso. */
export async function deleteAssetPhotoFiles(
  ...urls: string[]
): Promise<void> {
  await Promise.all(
    urls.map((url) =>
      unlink(path.join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ""))).catch(
        () => {}
      )
    )
  );
}

/* --------------------------------------------------- video del tutorial */

/** L'id fisso dell'unica riga di `TutorialVideo`: non ce n'è un secondo da
 * distinguere, quindi non si genera mai un id nuovo. */
export const TUTORIAL_VIDEO_ID = "singleton";

/**
 * Il tipo vero letto dai byte, come per le immagini — ma qui è l'unica
 * barriera: a differenza delle foto non c'è una libreria come `sharp` a
 * rielaborare il file e fare da seconda verifica, quindi questo controllo
 * resta più debole di `looksLikeImage`. Legge il box MP4 `ftyp` (quattro
 * byte di dimensione, poi la sigla ASCII) e controlla anche che la
 * dimensione dichiarata dal box abbia senso rispetto ai byte letti, non solo
 * che la sigla combaci.
 */
function looksLikeVideo(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const boxSize = buffer.readUInt32BE(0);
  const boxType = buffer.toString("ascii", 4, 8);
  if (boxType !== "ftyp") return false;
  return boxSize >= 8 && boxSize <= buffer.length;
}

/**
 * Salva il video del tutorial così com'è, senza elaborazione: non c'è
 * transcodifica nel progetto, quindi il file caricato è il file servito.
 * Un'unica cartella piatta (`tutorial/`, non una per utente/oggetto): è una
 * risorsa globale sola.
 */
export async function saveTutorialVideo(
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: "tooBig" | "invalidType" }> {
  if (file.size > MAX_TUTORIAL_VIDEO_BYTES) return { ok: false, error: "tooBig" };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeVideo(buffer)) return { ok: false, error: "invalidType" };

  const dir = path.join(UPLOAD_ROOT, "tutorial");
  await mkdir(dir, { recursive: true });

  const fileId = randomUUID();
  const filePath = path.join(dir, `${fileId}.mp4`);
  await writeFile(filePath, buffer);

  return { ok: true, url: `/uploads/tutorial/${fileId}.mp4` };
}

/** Cancellazione best-effort del video precedente: ogni `url` qui dentro è
 * per costruzione un file nostro (mai un indirizzo esterno), quindi non
 * serve il controllo che ha `deleteAvatarFile`. */
export async function deleteTutorialVideoFile(url: string | null): Promise<void> {
  if (!url) return;
  await unlink(path.join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ""))).catch(() => {});
}
