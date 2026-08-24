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

export async function assetQrDataUrl(assetId: string): Promise<string> {
  return QRCode.toDataURL(handoverUrl(assetId), {
    errorCorrectionLevel: "M",
    margin: 2,
    // Abbastanza grande da restare nitido stampato a pochi centimetri.
    width: 512,
  });
}
