// Rate limiting en memoire pour le formulaire de connexion. Suffisant pour un
// deploiement mono-instance ; a remplacer par un store partage (Redis) si le
// service est mis a l'echelle horizontalement.
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

// windowMs/maxAttempts optionnels : par defaut les valeurs historiques
// (connexion, 8 tentatives/15min) — les endpoints publics de verification
// (QR certificat/quittance) utilisent un budget plus genereux mais non nul
// (voir audit performance/securite 2026-09-02 : ces routes n'avaient aucune
// limite, ouvertes a l'enumeration de token).
export function isRateLimited(key: string, windowMs: number = WINDOW_MS, maxAttempts: number = MAX_ATTEMPTS): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > maxAttempts;
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
