/**
 * Serve il video del tutorial — pubblica, senza `requireAdmin`: l'overlay
 * della landing lo apre senza login, come le foto del catalogo.
 *
 * A differenza di `uploads.tsx` non basta `readFile` dell'intero file:
 * un video da fino a 200MB va letto in streaming, e il tag `<video>` chiede
 * il supporto a `Range` per il seek (trascinare la barra di avanzamento).
 * `Cache-Control: immutable` è corretto qui come per le foto: ogni
 * sostituzione genera un nuovo UUID nell'url, quindi questa risposta a
 * questo indirizzo non cambia mai.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import type { Route } from "./+types/uploads.tutorial";
import { db } from "~/lib/db.server";
import { UPLOAD_ROOT, TUTORIAL_VIDEO_ID } from "~/lib/uploads.server";

export async function loader({ request }: Route.LoaderArgs) {
  const video = await db.tutorialVideo.findUnique({
    where: { id: TUTORIAL_VIDEO_ID },
    select: { url: true },
  });
  if (!video) throw new Response("Not found", { status: 404 });

  const filePath = path.join(UPLOAD_ROOT, video.url.replace(/^\/uploads\//, ""));

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    throw new Response("Not found", { status: 404 });
  }

  const baseHeaders = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = request.headers.get("range");
  if (!range) {
    return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(size) },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (start >= size || end >= size || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  return new Response(
    Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream,
    {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    }
  );
}
