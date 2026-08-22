import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Chiffrement applicatif des champs sensibles (section 32) — utilise pour
// les donnees qui n'ont besoin ni d'etre recherchees ni d'etre filtrees en
// SQL (ex: DeathRecord.cause). Ne PAS appliquer a un champ utilise dans un
// `where`/`contains`/`@unique` : le chiffrement AES-GCM produit un texte
// different a chaque appel (IV aleatoire), ce qui casse toute recherche ou
// contrainte d'unicite sur la valeur en clair.
//
// AES-256-GCM : authentifie (integrite verifiee au dechiffrement, pas
// seulement confidentialite). Format stocke : "<iv_b64>:<tag_b64>:<ciphertext_b64>".

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommande pour GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY n'est pas defini. Generer avec: openssl rand -base64 32 (32 octets exactement).",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY doit decoder en exactement 32 octets (actuel: ${key.length}).`);
  }
  return key;
}

export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length !== 3) {
    // Donnee non chiffree (ex: import historique) : la renvoyer telle
    // quelle plutot que de faire planter l'affichage.
    return stored;
  }
  const [ivB64, tagB64, ciphertextB64] = parts;
  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // Cle rotee/incorrecte ou donnee corrompue : ne jamais faire planter
    // l'appelant pour un champ optionnel, signaler clairement a la place.
    return "[Donnee chiffree illisible — verifier ENCRYPTION_KEY]";
  }
}
