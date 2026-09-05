import { randomBytes, timingSafeEqual } from "crypto";

// Protection CSRF par "double-submit cookie" : un jeton aleatoire pose dans
// un cookie NON httpOnly (lisible par le JS du site, jamais par un site
// tiers) doit etre renvoye a l'identique dans un en-tete sur toute requete
// mutante — un site tiers peut faire suivre les cookies (c'est justement ce
// que sameSite=lax bloque deja pour les requetes cross-site), mais ne peut
// PAS lire ce cookie pour construire l'en-tete correspondant (politique de
// meme origine). S'ajoute a la protection sameSite=lax + Content-Type deja
// en place (README section Securite), en defense en profondeur — pas un
// remplacement.
//
// Serveur uniquement (utilise le module "crypto" de Node) — a n'importer
// que depuis proxy.ts / Route Handlers, jamais depuis un composant
// "use client" (voir ./csrf.ts pour les constantes client-safe).
export function generateCsrfToken() {
  return randomBytes(32).toString("hex");
}

// Comparaison a temps constant : une comparaison naive (===) sur un jeton
// secret permettrait en theorie une attaque par mesure de timing sur la
// position du premier octet different.
export function csrfTokensMatch(cookieValue: string | undefined, headerValue: string | undefined | null): boolean {
  if (!cookieValue || !headerValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requiresCsrfCheck(method: string) {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

// Endpoints mutants volontairement exemptes : pas de session/cookie
// navigateur, l'appelant n'est pas notre propre frontend donc n'a jamais eu
// l'occasion de lire le cookie CSRF. Leur securite vient d'ailleurs (secret
// partage / verification de signature propre au prestataire) — voir le
// commentaire dans chaque route.
// /api/v1/ (Integration & Interoperability Center) : systeme-a-systeme,
// authentifie par cle API (Authorization: Bearer / X-API-Key) via l'API
// Gateway (lib/integration/gateway.ts) — jamais par le cookie de session
// navigateur que le CSRF protege. Le jeton CSRF n'a jamais pu etre lu par cet
// appelant (ce n'est pas notre propre frontend), donc l'exiger serait a la
// fois inutile et bloquerait toute integration legitime.
const CSRF_EXEMPT_PREFIXES = ["/api/payments/callback/", "/api/cron/", "/api/v1/"];

export function isCsrfExempt(pathname: string) {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
