// Cache memoire a duree de vie (TTL), volontairement simple : approprie
// pour un deploiement mono-instance (voir docs/DEPLOYMENT.md — l'app est
// explicitement architecturee pour une seule instance aujourd'hui, meme
// constat que src/lib/rate-limit.ts). A remplacer par un store partage
// (Redis) uniquement si l'app est un jour deployee sur plusieurs instances
// — chaque instance aurait sinon son propre cache, incoherent entre elles.
//
// Reserve aux agregations couteuses dont une fraicheur de quelques dizaines
// de secondes est acceptable (statistiques de tableau de bord, tendances) —
// jamais pour des donnees ou l'exactitude immediate compte (soldes de
// caisse en cours de journee, disponibilite de creneaux...).
//
// Voir audit performance 2026-09-02 : ces agregats (getFinanceSummary,
// getRevenueTrend, getArrondissementStatsReport...) tournaient sans aucune
// mise en cache, recalcules integralement a chaque chargement du tableau de
// bord.
type Entry = { value: unknown; expiresAt: number };

const globalForCache = globalThis as unknown as { sigecCache?: Map<string, Entry> };
const store = globalForCache.sigecCache ?? new Map<string, Entry>();
if (process.env.NODE_ENV !== "production") globalForCache.sigecCache = store;

export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// A inclure dans toute cle de cache derivee de donnees visibles par
// l'utilisateur : deux utilisateurs de perimetres territoriaux differents
// ne doivent JAMAIS partager une entree de cache (fuite de donnees entre
// arrondissements sinon).
export function scopeCacheKey(user: { hasGlobalScope: boolean; arrondissementIds: string[] }): string {
  return user.hasGlobalScope ? "global" : [...user.arrondissementIds].sort().join(",");
}
