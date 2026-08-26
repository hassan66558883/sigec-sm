// Cote client-safe de l'i18n : aucun import de "next/headers" ici, pour
// pouvoir etre importe depuis des Client Components ("use client") comme
// sidebar-nav.tsx ou login-form.tsx sans faire fuiter de code serveur dans
// le bundle client. Le cote serveur (lecture du cookie de langue) vit dans
// ./server.ts.
import fr from "./messages/fr";

export type { Locale } from "./config";
export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, dirFor, isLocale } from "./config";

export type Dictionary = typeof fr;

type PathsToKeys<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : { [K in keyof T & string]: PathsToKeys<T[K], `${Prefix}${Prefix extends "" ? "" : "."}${K}`> }[keyof T & string];

export type TranslationKey = PathsToKeys<Dictionary>;

function resolve(dict: Dictionary, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), dict);
  return typeof value === "string" ? value : key;
}

// Interpolation simple {var} — suffisant pour ce dictionnaire, pas besoin
// d'un moteur ICU complet (pas de pluriels/genres a gerer dans les cles
// actuelles).
export function makeT(dict: Dictionary) {
  return (key: TranslationKey, vars?: Record<string, string | number>) => {
    let text = resolve(dict, key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    }
    return text;
  };
}
