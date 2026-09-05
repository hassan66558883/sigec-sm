// Constantes partagees client/serveur (aucun import Node ici — voir
// ./complaint-attachments.ts pour l'ecriture/lecture disque, qui utilise
// "fs/promises" et ne doit jamais etre importe depuis un composant
// "use client").
export const ATTACHMENT_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
export const ATTACHMENT_MAX_PER_COMPLAINT = 5;
