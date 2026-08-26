// Cote serveur uniquement (lit le cookie via next/headers) — a n'importer
// que depuis des Server Components / Route Handlers, jamais depuis un
// fichier "use client" (voir ./translate.ts pour la partie client-safe).
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dirFor, isLocale, type Locale } from "./config";
import { makeT, type Dictionary } from "./translate";
import fr from "./messages/fr";

const DICTIONARIES: Record<Locale, () => Promise<Dictionary>> = {
  fr: async () => fr,
  ar: async () => (await import("./messages/ar")).default,
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return DICTIONARIES[locale]();
}

// Lit la preference de langue depuis le cookie (voir /api/locale pour
// l'ecriture) — pas de prefixe d'URL par langue : la structure de routes
// existante (proxy.ts, tous les redirect("/admin") etc.) reste inchangee,
// seul le rendu textuel change selon le cookie.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { locale, dir: dirFor(locale), dict, t: makeT(dict) };
}
