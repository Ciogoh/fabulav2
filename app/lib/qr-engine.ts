/**
 * Il lettore di codici QR, in due strade — e sempre una sola scelta a runtime.
 *
 * **Solo browser.** Va importato con `import()` dentro a un gestore, mai in
 * cima a una rotta: tocca `window` e si porta dietro un megabyte di
 * WebAssembly, che sul server non serve a nessuno.
 *
 * 1. **`BarcodeDetector`**, quando c'è. È l'API del browser che gira sul
 *    riconoscitore del sistema operativo — ML Kit su Android — quindi a
 *    leggere il codice non è JavaScript ma codice nativo già ottimizzato.
 *    Non esiste niente di più veloce raggiungibile da una pagina web.
 *
 * 2. **`zxing-wasm`** altrove, cioè in pratica **su iPhone**: Safari non
 *    implementa `BarcodeDetector`, e siccome su iOS ogni browser è obbligato a
 *    usare WebKit non ce l'ha nessuno — nemmeno Chrome per iPhone. È ZXing-C++
 *    compilato in WebAssembly: circa il doppio più veloce di un decodificatore
 *    in JavaScript puro, e soprattutto molto più tollerante sui codici
 *    sfocati, storti o rovinati. Provato: legge il nostro QR anche disegnato
 *    a 80 pixel.
 *
 * Il file `.wasm` viene **servito da noi**, non da una CDN come farebbe la
 * libreria di suo: un'origine esterna in più significa una richiesta che può
 * fallire, e una cosa in più da permettere se un domani arriva una
 * `Content-Security-Policy` vera.
 */

/** Il testo letto, o `null` se in quel fotogramma non c'era niente. */
export type QrEngine = (image: ImageData) => Promise<string | null>;

type BarcodeDetectorLike = {
  detect(source: ImageData): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Quale strada è stata presa, per poterlo dire nell'interfaccia. */
export type EngineKind = "native" | "wasm";

export async function createQrEngine(): Promise<{ decode: QrEngine; kind: EngineKind }> {
  const native = await createNativeEngine();
  if (native) return { decode: native, kind: "native" };
  return { decode: await createWasmEngine(), kind: "wasm" };
}

async function createNativeEngine(): Promise<QrEngine | null> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;

  try {
    /* Esserci non basta: su qualche Android il costruttore c'è ma i formati
       arrivano da un modulo di sistema che va scaricato a parte, e finché non
       c'è la lista dei supportati è vuota. Meglio scoprirlo adesso che al
       primo fotogramma. */
    const formats = await Ctor.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) return null;

    const detector = new Ctor({ formats: ["qr_code"] });
    return async (image) => {
      const found = await detector.detect(image);
      return found[0]?.rawValue ?? null;
    };
  } catch {
    // Costruttore presente ma inservibile: si passa a WebAssembly.
    return null;
  }
}

async function createWasmEngine(): Promise<QrEngine> {
  const [reader, wasmUrl] = await Promise.all([
    import("zxing-wasm/reader"),
    import("zxing-wasm/reader/zxing_reader.wasm?url").then((module) => module.default),
  ]);

  reader.prepareZXingModule({ overrides: { locateFile: () => wasmUrl } });

  return async (image) => {
    const found = await reader.readBarcodes(image, {
      formats: ["QRCode"],
      /* `tryHarder` costa qualche millisecondo e in cambio legge i codici
         storti e sfocati — che è esattamente il caso di un adesivo su una
         cassa, inquadrato di sbieco con una mano sola. */
      tryHarder: true,
      // Ne cerchiamo uno: trovato quello, si cambia pagina.
      maxNumberOfSymbols: 1,
    });
    return found[0]?.text ?? null;
  };
}
