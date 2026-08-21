/**
 * Caricamento delle foto degli oggetti.
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

import { mkdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

export const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAIN_MAX_DIMENSION = 1600;
const THUMB_MAX_DIMENSION = 480;
const JPEG_QUALITY = 82;

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
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "tooBig" };

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
