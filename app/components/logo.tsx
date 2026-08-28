/**
 * Il lettering di Fabula, disegnato dentro al codice.
 *
 * Non è un `<img src="/logo.svg">` per due ragioni pratiche: un'immagine
 * esterna è una richiesta in più prima che l'intestazione si veda, e soprattutto
 * non può cambiare colore col tema. Qui il colore è una prop, quindi lo stesso
 * marchio serve sia l'intestazione sia un eventuale uso monocromatico.
 *
 * L'icona dell'app è un'altra cosa e sta altrove (`scripts/icons.ts`): il
 * lettering è largo 3,86:1 e dentro a un quadrato da 48 pixel non si legge,
 * quindi lì si usa la sola F. Se un giorno il marchio cambia, i posti da
 * toccare sono due — questo file e quello script — e non sedici PNG.
 */

/**
 * Il magenta del file consegnato dall'associazione.
 *
 * Sta scritto anche in `scripts/icons.ts`, e le due copie sono volute: quella
 * lì genera file che vivono fuori da Fabula (la schermata Home, una notifica)
 * dove i token di `app.css` non arrivano. Nota per chi farà il rebrand a
 * Material Matters: la direzione visiva registrata in CLAUDE.md è
 * monocromatica con accento **rosso**, e questo magenta non ci somiglia — è
 * il colore del logo che ci è stato dato, quindi vince, ma è il primo posto
 * da rivedere quando si allinea il resto.
 */
const BRAND = "#ec008c";

export function Logo({
  className = "",
  tone = "brand",
}: {
  className?: string;
  /** `current` eredita il colore del testo: serve dove il marchio deve stare
   * zitto — una filigrana, una stampa in bianco e nero. */
  tone?: "brand" | "current";
}) {
  return (
    <svg
      viewBox="0 0 728.91 188.98"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Fabula"
      fill={tone === "brand" ? BRAND : "currentColor"}
      className={className}
    >
      <polygon points="161.98 27 161.98 54 80.99 54 80.99 80.99 134.98 80.99 134.98 107.99 80.99 107.99 80.99 161.99 0 161.99 0 107.99 26.99 107.99 26.99 134.99 53.99 134.99 53.99 54 26.99 54 26.99 27" />
      <path d="M161.98,54v53.99h-27v27h-27v26.99h54v-26.99h53.99v26.99h-27v27h54V54h-80.99ZM215.97,107.99h-27v-27h27v27Z" />
      <path d="M350.95,107.99v-53.99h-53.99v-27h-27V0h-26.99v54h26.99v134.98h107.99v-80.99h-27ZM296.96,80.99h27v27h-27v-27ZM350.95,161.98h-53.99v-26.99h53.99v26.99Z" />
      <polygon points="512.93 27 512.93 54 485.94 54 485.94 161.98 404.95 161.98 404.95 54 350.95 54 350.95 27 431.94 27 431.94 134.99 458.94 134.99 458.94 27 512.93 27" />
      <polygon points="620.92 161.98 620.92 188.98 512.93 188.98 512.93 54 539.93 54 539.93 161.98 620.92 161.98" />
      <path d="M701.91,107.99V27h-80.99v53.99h-27v27h-26.99v27h53.99v-27h53.99v27h27v26.99h27v-53.99h-27ZM647.92,80.99v-26.99h26.99v26.99h-26.99Z" />
    </svg>
  );
}
