/**
 * Le icone di Fabula, tutte da un posto solo.
 *
 * Il logo dell'associazione è un lettering modulare largo 728 × 189, cioè
 * 3,86:1. Dentro a un'icona quadrata — che è l'unica forma che esista sulla
 * schermata Home di un telefono — diventerebbe una striscia alta un quinto e
 * illeggibile a 48 pixel. Quindi l'icona non è il logo intero: è la **F**, il
 * primo glifo, che è già quasi quadrato (162 × 135) e regge la riduzione.
 *
 * Perché uno script e non sedici PNG in una cartella: le icone si rifanno
 * ogni volta che il marchio cambia, e il marchio di Fabula cambierà almeno
 * ancora una volta (vedi il capitolo *Aspetto* di CLAUDE.md — l'allineamento
 * a Material Matters). Rifarle deve costare un comando, non un pomeriggio in
 * un editor grafico:
 *
 *     pnpm icons
 *
 * `sharp` c'è già per le foto degli oggetti (`uploads.server.ts`), quindi
 * questo script non aggiunge nessuna dipendenza.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");

/**
 * Il colore del marchio, e l'unico punto in cui è scritto.
 *
 * È il magenta del file che ci è stato consegnato (`fabulogo.svg`), non
 * l'accento dell'interfaccia: l'icona vive fuori da Fabula — sulla schermata
 * Home, in una notifica, nella barra delle applicazioni — dove i token di
 * `app.css` non arrivano e il tema chiaro/scuro non esiste. Se un giorno il
 * marchio diventa il rosso di Material Matters, si cambia questa riga e si
 * rilancia il comando.
 */
const BRAND = "#ec008c";

/** Il colore sopra al fondo pieno. Stessa regola di `--on-accent`: non è
 * "bianco" per abitudine, è "il colore che si legge sopra a BRAND". */
const ON_BRAND = "#ffffff";

/**
 * La F, normalizzata con l'angolo in alto a sinistra sull'origine.
 *
 * Presa di peso dal logo consegnato: è il quarto `<polygon>` del file, con
 * 27 sottratto a ogni ordinata perché lì il glifo comincia a y=27.
 */
const GLYPH = {
  width: 161.98,
  height: 134.99,
  points:
    "161.98 0 161.98 27 80.99 27 80.99 53.99 134.98 53.99 134.98 80.99 " +
    "80.99 80.99 80.99 134.99 0 134.99 0 80.99 26.99 80.99 26.99 107.99 " +
    "53.99 107.99 53.99 27 26.99 27 26.99 0",
};

/**
 * Compone il quadrato attorno al glifo.
 *
 * `coverage` è quanta parte del lato occupa il glifo in larghezza — la
 * larghezza e non l'altezza, perché la F è più larga che alta ed è quindi la
 * larghezza a toccare per prima il bordo.
 */
function square(size: number, coverage: number, fill: string, background?: string): string {
  const drawn = size * coverage;
  const scale = drawn / GLYPH.width;
  const tx = (size - drawn) / 2;
  const ty = (size - GLYPH.height * scale) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ""}
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})" fill="${fill}">
    <polygon points="${GLYPH.points}"/>
  </g>
</svg>`;
}

/** Da SVG a PNG. `density` alta perché sharp rasterizza l'SVG a 72dpi di
 * default e i bordi netti di un glifo modulare si sgranano subito. */
async function png(svg: string, file: string, opaque = false): Promise<void> {
  let image = sharp(Buffer.from(svg), { density: 384 });
  // Su iOS un PNG con canale alfa non diventa trasparente: diventa **nero**.
  // L'unica icona che lo pretende è `apple-touch-icon`, ma toglierlo dove non
  // serve non costa niente e non lascia la trappola in agguato.
  if (opaque) image = image.flatten({ background: BRAND });
  await image.png({ compressionLevel: 9 }).toFile(path.join(ICONS_DIR, file));
  console.log(`  public/icons/${file}`);
}

async function main(): Promise<void> {
  await mkdir(ICONS_DIR, { recursive: true });

  console.log("Icone di Fabula:");

  /* La favicon moderna, in vettoriale: una sola per ogni densità di schermo,
     e il magenta si legge sia sulla barra chiara sia su quella scura, quindi
     non serve la versione per tema. Il fondo resta trasparente perché una
     scheda non è un quadrato: è il colore della barra. */
  await writeFile(
    path.join(PUBLIC_DIR, "icon.svg"),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!-- Generata da scripts/icons.ts (\`pnpm icons\`). Non modificare a mano. -->\n` +
      square(512, 0.72, BRAND).replace("<svg ", `<svg role="img" aria-label="Fabula" `) +
      "\n"
  );
  console.log("  public/icon.svg");

  /* Il ripiego per i browser che la favicon vettoriale non la leggono. */
  await png(square(32, 0.78, BRAND), "favicon-32.png");

  /* Le due misure che il manifesto pretende. Fondo pieno e non trasparente:
     un'icona trasparente su uno sfondo chiaro sparisce, e la schermata Home
     di metà del mondo è una fotografia chiara. */
  await png(square(192, 0.64, ON_BRAND, BRAND), "icon-192.png");
  await png(square(512, 0.64, ON_BRAND, BRAND), "icon-512.png");

  /* La *maskable*: Android ritaglia l'icona con la forma che ha deciso il
     produttore del telefono — cerchio, goccia, quadrato stondato — e
     garantisce solo il cerchio centrale dell'80%. Il glifo scende quindi al
     52% del lato, così sta dentro alla circonferenza sicura anche negli
     angoli: metà diagonale = √(133² + 111²) = 173 px su 512, cioè un cerchio
     da 347 dentro ai 410 garantiti. Il fondo pieno arriva invece fino al
     bordo, o il ritaglio mostrerebbe il vuoto. */
  await png(square(512, 0.52, ON_BRAND, BRAND), "icon-512-maskable.png");

  /* iOS: misura sua, angoli stondati da lui, e niente trasparenza. */
  await png(square(180, 0.6, ON_BRAND, BRAND), "apple-touch-icon-180.png", true);

  /* Il *badge* delle notifiche Android: non è un'icona, è una maschera. Il
     sistema ne legge **solo il canale alfa** e la ridisegna del colore che
     vuole lui, di solito bianco sulla barra di stato. Un PNG a colori qui
     esce come una macchia grigia. */
  await png(square(96, 0.72, "#000000"), "badge-96.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
