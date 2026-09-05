import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ApiError } from "@/lib/api";
import { ATTACHMENT_ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from "@/lib/complaint-attachment-constants";

// Stockage disque local (module Plaintes & Doleances, Phase 8) — decision
// prise en l'absence de toute config objet-storage/S3 existante sur ce
// projet et d'un deploiement prevu sur un serveur Linux unique (voir
// docs/DEPLOYMENT.md) : le disque local est le choix le plus simple et le
// plus reversible. JAMAIS sous /public — un fichier n'est accessible que
// via la route de telechargement authentifiee (verifie propriete du
// dossier cote citoyen, RBAC + perimetre territorial cote agent — voir
// getComplaintAttachmentForCitizen/Staff dans services/complaints.ts),
// jamais par URL statique directe.
const STORAGE_ROOT = path.join(process.cwd(), "storage", "complaints");

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export function validateAttachmentFile(file: File) {
  if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ApiError(400, "Type de fichier non autorise (image JPEG/PNG/WEBP ou PDF uniquement).");
  }
  if (file.size <= 0 || file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    throw new ApiError(400, "Fichier trop volumineux (10 Mo maximum).");
  }
}

// Le nom de fichier sur disque est TOUJOURS genere (jamais derive du nom
// fourni par le client, meme "assaini") — evite toute traversee de chemin
// par construction plutot que par filtrage a posteriori.
export async function saveAttachmentFile(complaintId: string, file: File) {
  validateAttachmentFile(file);
  const dir = path.join(STORAGE_ROOT, complaintId);
  await mkdir(dir, { recursive: true });
  const diskName = `${randomUUID()}${EXTENSION_BY_MIME[file.type] ?? ""}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, diskName), buffer);
  return {
    fileName: file.name.slice(0, 255),
    storagePath: path.join(complaintId, diskName),
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

// storagePath ne doit jamais provenir directement d'une requete utilisateur
// — seulement d'une ligne ComplaintAttachment deja verifiee en base (voir
// services/complaints.ts). Le garde-fou resolve()/startsWith() ci-dessous
// est une defense en profondeur, pas la protection principale.
export async function readAttachmentFile(storagePath: string) {
  const fullPath = path.resolve(STORAGE_ROOT, storagePath);
  if (!fullPath.startsWith(STORAGE_ROOT + path.sep)) {
    throw new ApiError(400, "Chemin de fichier invalide.");
  }
  return readFile(fullPath);
}
