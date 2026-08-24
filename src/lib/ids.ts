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

// Identifiant d'emplacement structure (section 7 du module recettes
// municipales), ex: NDJ-A01-MKT-000001 ou NDJ-A01-Q05-BT-000123.
// `sequence` doit venir d'un compteur Postgres monotone (colonne
// `@default(autoincrement())`) jamais reutilise, meme apres suppression —
// c'est ce qui garantit la regle "ne jamais reutiliser un identifiant".
export function generateEmplacementCode(opts: {
  arrondissementNumber: number;
  quartierCode?: string | null;
  typeCode: string; // MKT | BT | ...
  sequence: number;
}) {
  const parts = ["NDJ", `A${String(opts.arrondissementNumber).padStart(2, "0")}`];
  if (opts.quartierCode) parts.push(opts.quartierCode);
  parts.push(opts.typeCode, String(opts.sequence).padStart(6, "0"));
  return parts.join("-");
}

// Numero de recu sequentiel (section 18), ex: REC-2026-00000001. `sequence`
// doit venir de Receipt.sequence (compteur Postgres monotone, jamais
// reutilise meme apres annulation).
export function generateReceiptNumber(sequence: number) {
  const year = new Date().getFullYear();
  return `REC-${year}-${String(sequence).padStart(8, "0")}`;
}

// Numero d'obligation, ex: OBL-2026-9F3A21B4. Meme convention entropique que
// generateRecordNumber (pas de risque de course).
export function generateObligationNumber() {
  return generateRecordNumber("OBL");
}

// Matricule agent collecteur, ex: AGT-2026-9F3A21B4.
export function generateAgentMatricule() {
  return generateRecordNumber("AGT");
}

// Cle de licence TECHNOTCHAD, ex: SIGEC-SM-9F3A-21B4-7C08-EE31. Entropie
// aleatoire (jamais reutilisee), regroupee en blocs de 4 pour la lisibilite
// lors d'une saisie manuelle d'activation.
export function generateLicenseKey(productCode: string) {
  const blocks = Array.from({ length: 4 }, () => randomBytes(2).toString("hex").toUpperCase());
  return `${productCode}-${blocks.join("-")}`;
}
