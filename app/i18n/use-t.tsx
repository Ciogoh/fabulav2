/**
 * L'accesso alle traduzioni dai componenti.
 *
 * La lingua la decide il loader di `root` e scende da lì, così ogni pagina
 * la vede senza doversela ripassare a mano di componente in componente.
 */

import { createContext, useContext, useMemo, type ReactNode, type Context } from "react";
import {
  translate,
  type Lang,
  type TranslationKey,
} from "~/i18n/dictionaries";

type Translator = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

// Durante HMR i consumatori e il provider possono aggiornarsi separatamente.
// Conservare il contesto evita che la preview torni alla lingua di ripiego.
const LangContext: Context<Lang> = import.meta.hot?.data.langContext ?? createContext<Lang>("en");
if (import.meta.hot) import.meta.hot.data.langContext = LangContext;

export function LangProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): Translator {
  const lang = useLang();
  return useMemo(
    () => (key, params) => translate(lang, key, params),
    [lang]
  );
}

/** Le date si mostrano nel formato della lingua scelta, non in ISO. */
export function useFormatDay(): (date: Date | string) => string {
  const lang = useLang();

  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    return (date) => formatter.format(new Date(date));
  }, [lang]);
}
