/**
 * Il carrello, prima dell'accesso.
 *
 * Sta in `sessionStorage` di proposito: chi sfoglia il catalogo non ha ancora
 * un account, e la scelta non deve andare persa nel momento in cui il sistema
 * gli chiede chi è. Al momento della registrazione questo contenuto diventa
 * una richiesta vera sul database.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "fabula.cart";

export type CartEntry = {
  assetId: string;
  name: string;
  /** Da quale kit era stato aggiunto, se veniva da un kit. */
  fromKitId?: string;
  fromKitName?: string;
};

function read(): CartEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartEntry[]) : [];
  } catch {
    // Contenuto illeggibile (versione vecchia, modifica a mano): meglio
    // ripartire da un carrello vuoto che rompere tutta la pagina.
    return [];
  }
}

export function useCart() {
  // Si parte sempre vuoti e si legge dopo il montaggio: il server non ha
  // accesso a sessionStorage, e leggerlo durante il primo render darebbe
  // un HTML diverso fra server e browser.
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(read());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.sessionStorage.setItem(KEY, JSON.stringify(entries));
  }, [entries, ready]);

  const add = useCallback((incoming: CartEntry | CartEntry[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];

    setEntries((current) => {
      const seen = new Set(current.map((entry) => entry.assetId));
      const fresh = list.filter((entry) => !seen.has(entry.assetId));
      return fresh.length ? [...current, ...fresh] : current;
    });
  }, []);

  const remove = useCallback((assetId: string) => {
    setEntries((current) =>
      current.filter((entry) => entry.assetId !== assetId)
    );
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const has = useCallback(
    (assetId: string) => entries.some((entry) => entry.assetId === assetId),
    [entries]
  );

  return { entries, add, remove, clear, has, ready };
}
