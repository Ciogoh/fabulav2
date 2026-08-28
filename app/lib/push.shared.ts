/**
 * Il nome leggibile di un dispositivo iscritto alle notifiche.
 *
 * Serve a una domanda sola, nella schermata del profilo: «quale di questi
 * sono io?». Chi ha telefono e portatile vede due righe, e due righe che
 * dicono entrambe «dispositivo» non aiutano nessuno a capire quale spegnere.
 *
 * Non è riconoscimento serio del browser e non deve diventarlo: la stringa
 * dello user agent è una bugia storica che ogni browser racconta per
 * assomigliare agli altri — Chrome dice di essere Safari, Edge dice di essere
 * Chrome. Qui si cercano gli indizi **nell'ordine in cui si smentiscono a
 * vicenda**, e se non si capisce si dice così invece di indovinare.
 */

export function deviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null;

  const browser = browserOf(userAgent);
  const system = systemOf(userAgent);

  if (browser && system) return `${browser} · ${system}`;
  return browser ?? system;
}

function browserOf(userAgent: string): string | null {
  // L'ordine conta ed è il contrario di quello che verrebbe da scrivere:
  // ogni riga esclude quelle sotto. Edge si dichiara anche Chrome, Chrome si
  // dichiara anche Safari, e cercare "Safari" per primo li chiamerebbe tutti
  // Safari.
  if (/\bEdgA?\//.test(userAgent)) return "Edge";
  if (/\bSamsungBrowser\//.test(userAgent)) return "Samsung Internet";
  if (/\bOPR\//.test(userAgent)) return "Opera";
  if (/\bFirefox\/|\bFxiOS\//.test(userAgent)) return "Firefox";
  if (/\bChrome\/|\bCriOS\//.test(userAgent)) return "Chrome";
  if (/\bSafari\//.test(userAgent)) return "Safari";
  return null;
}

function systemOf(userAgent: string): string | null {
  if (/\bAndroid\b/.test(userAgent)) return "Android";
  // iPadOS si presenta come un Mac da anni: qui non si può smascherare
  // (servono i punti di tocco, che vivono solo nel browser), quindi un iPad
  // risulterà "macOS". È una didascalia, non un'identificazione.
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return "iOS";
  if (/\bWindows\b/.test(userAgent)) return "Windows";
  if (/\bMac OS X\b/.test(userAgent)) return "macOS";
  if (/\bLinux\b/.test(userAgent)) return "Linux";
  return null;
}
