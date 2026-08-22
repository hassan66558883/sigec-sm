// Rate limiting en memoire pour le formulaire de connexion. Suffisant pour un
// deploiement mono-instance ; a remplacer par un store partage (Redis) si le
// service est mis a l'echelle horizontalement.
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
