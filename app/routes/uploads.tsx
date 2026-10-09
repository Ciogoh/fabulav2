/** Foto pubbliche solo dopo l'approvazione; bozze e proposte richiedono accesso. */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Route } from "./+types/uploads";
import { UPLOAD_ROOT } from "~/lib/uploads.server";
import { db } from "~/lib/db.server";
import { getUser } from "~/lib/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const rel = params["*"] ?? "";
  const filePath = path.join(UPLOAD_ROOT, rel);

  if (!rel || rel.includes("..") || !filePath.startsWith(UPLOAD_ROOT)) {
    throw new Response("Not found", { status: 404 });
  }

  // Anche conoscere l'URL non permette di leggere una proposta non pubblicata.
  let personal = false;
  if (rel.startsWith("assets/")) {
    const url = `/uploads/${rel}`;
    const photo = await db.assetPhoto.findFirst({
      where: { OR: [{ url }, { thumbUrl: url }] },
      select: { asset: { select: { ownerId: true, status: true, archivedAt: true } } },
    });
    if (!photo) throw new Response("Not found", { status: 404 });
    personal = photo.asset.ownerId !== null;
    if (photo.asset.status !== "APPROVED" || photo.asset.archivedAt) {
      const user = await getUser(request);
      if (!user || (user.role !== "ADMIN" && user.id !== photo.asset.ownerId)) {
        throw new Response("Not found", { status: 404 });
      }
      personal = true;
    }
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    throw new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      // I nomi sono generati per-caricamento e mai riusati: la stessa
      // risposta a questo indirizzo non cambierà mai.
      "Cache-Control": personal ? "private, no-store" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
