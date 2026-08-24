/**
 * Il codice QR di un oggetto.
 *
 * Il QR contiene un **indirizzo intero**, non l'identificativo nudo. Costa
 * una trentina di caratteri in più nel disegno e in cambio l'adesivo funziona
 * anche con la fotocamera di sistema del telefono — quella di Foto/Fotocamera,
 * senza aprire Fabula — che riconosce un `https://…` e offre di aprirlo,
 * mentre di un `cmf3x9k2p0000` non saprebbe che fare. Lo scanner dentro
 * all'applicazione resta comodo per chi sta già facendo un giro in magazzino,
 * ma non è più l'unico modo di leggere l'etichetta.
 *
 * L'immagine è un `data:` URL PNG, quindi viaggia dentro all'HTML della
 * pagina e non ha bisogno di essere salvata da nessuna parte: un file in più
 * sul disco per ogni oggetto sarebbe roba da tenere sincronizzata con le
 * righe del database, e il disegno si rifà in un millisecondo ogni volta che
 * serve.
 *
 * **Il livello di correzione è `M`, non `L`.** Questi finiscono su adesivi
 * attaccati a casse e treppiedi che vivono in magazzino: si sgualciscono, si
 * sporcano, prendono il sole. `M` recupera fino al 15% del disegno rovinato e
 * costa solo un pizzico di densità in più.
 */

import QRCode from "qrcode";

/**
 * L'indirizzo che finisce dentro al QR: la pagina di consegna di quell'oggetto.
 *
 * Passa da `APP_URL` e non dall'origine della richiesta perché un adesivo è
 * per sempre: se qualcuno generasse i QR mentre lavora su `localhost:5173`,
 * stamperebbe etichette che fuori da quel computer non aprono niente.
 */
export function handoverUrl(assetId: string): string {
  const base = process.env.APP_URL ?? "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/admin/handover/${assetId}`;
}

/**
 * L'indirizzo **corto e maiuscolo** che finisce davvero dentro all'adesivo.
 *
 * Due trucchi che insieme fanno moduli più grandi del 28% a parità di carta,
 * e un modulo più grande è la differenza fra leggere a venti centimetri e
 * leggere a quaranta:
 *
 * - **`/h/` invece di `/admin/handover/`**: tredici caratteri in meno.
 * - **tutto maiuscolo**: il QR ha una modalità alfanumerica che sta in
 *   undici bit ogni due caratteri, ma accetta solo `0-9 A-Z` e una manciata
 *   di simboli. Una sola minuscola costringe l'intero codice alla modalità
 *   byte, otto bit per carattere. I domini sono insensibili alle maiuscole
 *   per definizione, e il nostro identificativo è un cuid — solo cifre e
 *   lettere — quindi rimetterlo in minuscolo dall'altra parte è esatto.
 *
 * Misurato su un adesivo da 4 cm, con lo stesso identificativo:
 * `/admin/handover/<cuid>` fa 37×37 moduli (1,08 mm l'uno), questo ne fa
 * 29×29 (1,38 mm). Il vecchio indirizzo resta valido e raggiungibile: gli
 * adesivi già stampati continuano a funzionare.
 */
export function shortHandoverUrl(assetId: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}/h/${assetId}`.toUpperCase();
}

export async function assetQrDataUrl(assetId: string): Promise<string> {
  return QRCode.toDataURL(shortHandoverUrl(assetId), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}

