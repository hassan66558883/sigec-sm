import { randomBytes } from "crypto";

// Numero lisible mais garanti unique (entropie aleatoire, pas de COUNT()
// sujet aux conditions de course sous ecriture concurrente).
export function generateRecordNumber(prefix: string) {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${year}-${suffix}`;
}

// Token de verification publique (QR) : suffisamment long pour etre
// impossible a deviner, url-safe.
export function generateVerificationToken() {
  return randomBytes(24).toString("base64url");
}
