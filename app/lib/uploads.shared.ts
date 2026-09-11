/**
 * I limiti di una foto caricata, dalla parte del browser e da quella del
 * server.
 *
 * Stanno qui e non in `uploads.server.ts` perché quel file importa `sharp` e
 * il modulo dei file: importarlo da un componente si porterebbe mezzo Node
 * dentro al pacchetto del browser. Sono gli stessi numeri di
 * `availability.shared.ts`, per la stessa ragione — un file rifiutato qui e
 * accettato là (o viceversa) è un'attesa per niente, o un errore che arriva
 * troppo tardi.
 *
 * Erano scritti due volte, con un commento che chiedeva di tenerli allineati
 * a mano. Al terzo punto d'uso — la foto del profilo — è diventato un posto
 * solo.
 */

/** Cinque megabyte: sopra, il server rifiuta prima ancora di leggerli. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Gli unici tre formati che Fabula legge. Il tipo dichiarato dal browser vale
 * solo per fermare subito uno sbaglio evidente: la parola definitiva la dice
 * `looksLikeImage` in `uploads.server.ts`, che guarda i byte veri.
 */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Da mettere nell'attributo `accept` di un `<input type="file">`. */
export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

/** Duecento megabyte: un video del tutorial, non un archivio. */
export const MAX_TUTORIAL_VIDEO_BYTES = 200 * 1024 * 1024;

/** Un formato solo — mp4 — perché è l'unico che tutti i browser sanno
 * riprodurre senza plugin, ed è quello che chiede il tag `<video>` nativo. */
export const ACCEPTED_VIDEO_TYPES = ["video/mp4"];
export const ACCEPTED_VIDEO_ACCEPT = ACCEPTED_VIDEO_TYPES.join(",");
