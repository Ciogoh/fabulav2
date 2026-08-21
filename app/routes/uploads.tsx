/**
 * Serve le foto caricate — pubblica, senza `requireAdmin`: compaiono nel
 * catalogo anonimo, è corretto che si vedano senza accesso. L'unica guardia
 * è contro un percorso che esce dalla cartella con `..`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Route } from "./+types/uploads";
import { UPLOAD_ROOT } from "~/lib/uploads.server";

export async function loader({ params }: Route.LoaderArgs) {
  const rel = params["*"] ?? "";
  const filePath = path.join(UPLOAD_ROOT, rel);

  if (!rel || rel.includes("..") || !filePath.startsWith(UPLOAD_ROOT)) {
    throw new Response("Not found", { status: 404 });
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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
