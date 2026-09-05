import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateVerificationToken } from "@/lib/ids";
import { withBalance } from "@/lib/services/obligations";
import { detectInvalidQrScan, detectQrScanVolumeAnomaly } from "@/lib/services/fraud";

// Systeme QR reutilisable (module paiement QR, section 3) : entityType/
// entityId est une reference polymorphe deliberee vers n'importe quelle
// entite municipale QR-able (Business, MarketStall, et d'autres a l'avenir
// sans jamais modifier ce fichier au-dela de cette liste). Le token encode
// dans le QR ne contient JAMAIS le montant (regle absolue section 2) — un
// scan interroge toujours le serveur pour la valeur courante.
export const QR_ENTITY_TYPES = ["BUSINESS", "MARKET_STALL"] as const;
export type QrEntityType = (typeof QR_ENTITY_TYPES)[number];

const OPEN_OBLIGATION_STATUSES = ["A_PAYER", "PARTIELLEMENT_PAYE", "EN_RETARD"];

type ResolvedEntity = { arrondissementId: string; label: string; reference: string | null };

async function resolveEntityForAdmin(entityType: string, entityId: string): Promise<ResolvedEntity> {
  if (entityType === "BUSINESS") {
    const business = await prisma.business.findUnique({ where: { id: entityId } });
    if (!business) throw new ApiError(404, "Commerce introuvable.");
    return { arrondissementId: business.arrondissementId, label: business.name, reference: business.code };
  }
  if (entityType === "MARKET_STALL") {
    const stall = await prisma.marketStall.findUnique({ where: { id: entityId }, include: { market: true } });
    if (!stall) throw new ApiError(404, "Emplacement introuvable.");
    return { arrondissementId: stall.market.arrondissementId, label: `${stall.market.name} — ${stall.code}`, reference: stall.code };
  }
  throw new ApiError(400, "Type d'entite QR invalide.");
}

async function recordEvent(qrCodeId: string, event: string, actorId?: string, metadata?: Record<string, unknown>) {
  await prisma.qrCodeEvent.create({ data: { qrCodeId, event, actorId, metadata: metadata as Prisma.InputJsonValue | undefined } });
}

// Genere un nouveau QR pour une entite (section 6). Une entite ne peut avoir
// qu'un seul QR ACTIVE simultanement (le token lui-meme est deja unique
// globalement en base — cette regle empeche en plus deux QR actifs
// concurrents pour LA MEME entite).
export async function generateQrCode(actor: CurrentUser, entityType: string, entityId: string) {
  if (!can(actor, "qr_codes", "generate")) throw new ApiError(403, "Permission insuffisante.");
  const entity = await resolveEntityForAdmin(entityType, entityId);
  if (!canAccessArrondissement(actor, entity.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const existingActive = await prisma.qrCode.findFirst({ where: { entityType, entityId, status: "ACTIVE" } });
  if (existingActive) throw new ApiError(400, "Cette entite dispose deja d'un QR actif — revoquez-le d'abord, ou utilisez le remplacement.");

  const created = await prisma.qrCode.create({
    data: { token: generateVerificationToken(), entityType, entityId, issuedById: actor.id },
  });
  await recordEvent(created.id, "GENERATED", actor.id, { label: entity.label });

  await logAudit({
    user: actor,
    action: "QR_GENERATE",
    module: "qr_codes",
    entityType: "QrCode",
    entityId: created.id,
    arrondissementId: entity.arrondissementId,
    newValue: { targetEntityType: entityType, targetEntityId: entityId, label: entity.label },
  });

  return created;
}

// Revoque un QR (perte, vol, degradation, fraude suspectee — section 25).
// Jamais de suppression : le statut passe a REVOKED, l'historique
// (QrCodeEvent) reste consultable en entier.
export async function revokeQrCode(actor: CurrentUser, qrCodeId: string, reason: string) {
  if (!can(actor, "qr_codes", "revoke")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const qr = await prisma.qrCode.findUnique({ where: { id: qrCodeId } });
  if (!qr) throw new ApiError(404, "QR introuvable.");
  if (qr.status !== "ACTIVE") throw new ApiError(400, "Ce QR n'est pas actif.");
  const entity = await resolveEntityForAdmin(qr.entityType, qr.entityId);
  if (!canAccessArrondissement(actor, entity.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const updated = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedById: actor.id, revokedReason: reason.trim() },
  });
  await recordEvent(qrCodeId, "REVOKED", actor.id, { reason: reason.trim() });

  await logAudit({
    user: actor,
    action: "QR_REVOKE",
    module: "qr_codes",
    entityType: "QrCode",
    entityId: qrCodeId,
    arrondissementId: entity.arrondissementId,
    newValue: { reason: reason.trim() },
  });

  return updated;
}

// Remplace un QR (perte/vol/degradation — section 25) : revoque l'ancien
// (quel que soit son statut courant) et genere un nouveau dans la meme
// transaction, en conservant le lien replaces/replacedBy pour l'historique
// complet exige par le cahier des charges.
export async function replaceQrCode(actor: CurrentUser, oldQrCodeId: string, reason: string) {
  if (!can(actor, "qr_codes", "replace")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const old = await prisma.qrCode.findUnique({ where: { id: oldQrCodeId } });
  if (!old) throw new ApiError(404, "QR introuvable.");
  const entity = await resolveEntityForAdmin(old.entityType, old.entityId);
  if (!canAccessArrondissement(actor, entity.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const [, created] = await prisma.$transaction([
    prisma.qrCode.update({
      where: { id: oldQrCodeId },
      data: { status: "REPLACED", revokedAt: new Date(), revokedById: actor.id, revokedReason: reason.trim() },
    }),
    prisma.qrCode.create({
      data: { token: generateVerificationToken(), entityType: old.entityType, entityId: old.entityId, issuedById: actor.id, replacesId: oldQrCodeId },
    }),
  ]);
  await recordEvent(created.id, "GENERATED", actor.id, { replaces: oldQrCodeId, label: entity.label });
  await recordEvent(oldQrCodeId, "REPLACED", actor.id, { reason: reason.trim(), replacedBy: created.id });

  await logAudit({
    user: actor,
    action: "QR_REPLACE",
    module: "qr_codes",
    entityType: "QrCode",
    entityId: created.id,
    arrondissementId: entity.arrondissementId,
    oldValue: { oldQrCodeId },
    newValue: { reason: reason.trim() },
  });

  return created;
}

// Confirmation terrain de pose physique (section 40) — trace date/agent/GPS,
// n'affecte jamais le statut du QR (une pose confirmee n'active rien qui ne
// le soit deja : le QR est utilisable des sa generation, cette etape ne sert
// qu'a la lutte anti-faux-enregistrement).
export async function confirmQrInstallation(actor: CurrentUser, qrCodeId: string, gps?: { lat: number; lng: number }) {
  if (!can(actor, "qr_codes", "verify_install")) throw new ApiError(403, "Permission insuffisante.");
  const qr = await prisma.qrCode.findUnique({ where: { id: qrCodeId } });
  if (!qr) throw new ApiError(404, "QR introuvable.");
  const entity = await resolveEntityForAdmin(qr.entityType, qr.entityId);
  if (!canAccessArrondissement(actor, entity.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const updated = await prisma.qrCode.update({
    where: { id: qrCodeId },
    data: { installedAt: new Date(), installedById: actor.id, installGpsLat: gps?.lat, installGpsLng: gps?.lng },
  });
  await recordEvent(qrCodeId, "INSTALLED", actor.id, gps ? { gps } : undefined);

  await logAudit({
    user: actor,
    action: "QR_INSTALL_CONFIRM",
    module: "qr_codes",
    entityType: "QrCode",
    entityId: qrCodeId,
    arrondissementId: entity.arrondissementId,
    newValue: { gps },
  });

  return updated;
}

// Inspection administrative d'un QR (section 26) — meme fonction que le scan
// public mais reservee aux agents, avec le detail complet (statut du QR,
// historique de remplacement).
export async function inspectQrCode(actor: CurrentUser, qrCodeId: string) {
  if (!can(actor, "qr_codes", "view")) throw new ApiError(403, "Permission insuffisante.");
  const qr = await prisma.qrCode.findUnique({
    where: { id: qrCodeId },
    include: { events: { orderBy: { createdAt: "asc" } }, replaces: true, replacedBy: true },
  });
  if (!qr) throw new ApiError(404, "QR introuvable.");
  const entity = await resolveEntityForAdmin(qr.entityType, qr.entityId);
  if (!canAccessArrondissement(actor, entity.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return { ...qr, entityLabel: entity.label, entityReference: entity.reference };
}

// Image QR imprimable (section 6/7), generee a la volee — encode l'URL
// publique /pay/<token> UNIQUEMENT (jamais un montant, regle absolue
// section 2). Meme convention que generateReceiptQrPng().
export async function generateEntityQrPng(qrToken: string, baseUrl: string) {
  const url = `${baseUrl}/pay/${qrToken}`;
  return QRCode.toBuffer(url, { type: "png", margin: 1, width: 400 });
}

export async function listQrCodesForEntity(actor: CurrentUser, entityType: string, entityId: string) {
  if (!can(actor, "qr_codes", "view")) throw new ApiError(403, "Permission insuffisante.");
  const entity = await resolveEntityForAdmin(entityType, entityId);
  if (!canAccessArrondissement(actor, entity.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return prisma.qrCode.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
}

// --- Scan public (aucune authentification — section 41) ---------------------

export type QrScanResult =
  | { found: false }
  | {
      found: true;
      valid: boolean; // false si REVOKED/REPLACED
      status: string;
      entityType: QrEntityType;
      reference: string;
      name: string;
      arrondissementName: string;
      quartierName?: string;
      operatingStatus: string; // statut d'exploitation de l'entite (ACTIVE/SUSPENDUE/... ou AVAILABLE/OCCUPIED/...), distinct du statut du QR
      outstanding: { total: number; obligations: { id: string; number: string; period: string; balance: number; dueDate: Date }[] };
    };

// Point d'entree du scan (section 2/8) : identifie l'entite et calcule le
// solde courant a la volee — jamais de montant fige dans le QR. Aucune
// donnee personnelle du proprietaire (nom du citoyen, telephone...) n'est
// jamais renvoyee ici, seulement le nom COMMERCIAL de l'entite (meme regle
// que verifyReceiptPublic()). Chaque scan trace un evenement SCANNED, y
// compris sur un QR revoque — utile pour la detection d'usage frauduleux
// (section 23).
export async function resolveQrToken(token: string): Promise<QrScanResult> {
  const qr = await prisma.qrCode.findUnique({ where: { token } });
  if (!qr) return { found: false };

  await recordEvent(qr.id, "SCANNED");

  if (qr.entityType === "BUSINESS") {
    const business = await prisma.business.findUnique({ where: { id: qr.entityId }, include: { arrondissement: true, quartier: true } });
    if (!business) return { found: false };
    if (qr.status !== "ACTIVE") await detectInvalidQrScan(qr.id, business.name, business.arrondissementId);
    await detectQrScanVolumeAnomaly(qr.id, business.name, business.arrondissementId);
    return buildScanResult(qr, {
      entityType: "BUSINESS",
      reference: business.code ?? business.id,
      name: business.name,
      arrondissementName: business.arrondissement.name,
      quartierName: business.quartier?.name,
      operatingStatus: business.status,
      obligationWhere: { businessId: business.id },
    });
  }

  if (qr.entityType === "MARKET_STALL") {
    const stall = await prisma.marketStall.findUnique({
      where: { id: qr.entityId },
      include: { market: { include: { arrondissement: true, quartier: true } } },
    });
    if (!stall) return { found: false };
    const label = `${stall.market.name} — Emplacement ${stall.code}`;
    if (qr.status !== "ACTIVE") await detectInvalidQrScan(qr.id, label, stall.market.arrondissementId);
    await detectQrScanVolumeAnomaly(qr.id, label, stall.market.arrondissementId);
    return buildScanResult(qr, {
      entityType: "MARKET_STALL",
      reference: `${stall.market.code ?? ""}-${stall.code}`,
      name: label,
      arrondissementName: stall.market.arrondissement.name,
      quartierName: stall.market.quartier?.name,
      operatingStatus: stall.status,
      obligationWhere: { marketStallId: stall.id },
    });
  }

  return { found: false };
}

// --- Scan agent (collecte terrain, section 21) ------------------------------

export type QrCollectionResult = {
  entityType: QrEntityType;
  entityLabel: string;
  citizen: { id: string; firstName: string; lastName: string; uniqueNumber: string; phone: string | null };
  obligations: ReturnType<typeof withBalance>[];
};

// Resolution authentifiee d'un QR pour un agent en collecte terrain (section
// 21 : "l'agent scanne le QR pour identifier l'entite et encaisser").
// Contrairement a resolveQrToken() (scan public, anonymise), ici l'agent est
// deja authentifie et doit connaitre le payeur legal (proprietaire/occupant)
// pour enregistrer le paiement via le meme flux que la recherche manuelle
// (recordPayment() dans payments.ts, inchange). Le controle de zone
// anti-fraude (isAgentAssignedToZone) reste applique par recordPayment lui
// meme, pas ici — cette fonction ne fait qu'identifier l'entite/le solde.
export async function resolveQrForCollection(actor: CurrentUser, token: string): Promise<QrCollectionResult> {
  if (!can(actor, "payments", "create")) throw new ApiError(403, "Permission insuffisante.");
  const qr = await prisma.qrCode.findUnique({ where: { token } });
  if (!qr) throw new ApiError(404, "QR introuvable.");

  // Journalise le scan meme si le QR n'est plus actif (meme regle que
  // resolveQrToken() — utile pour la detection d'usage frauduleux, section 23).
  await recordEvent(qr.id, "SCANNED_BY_AGENT", actor.id);

  let citizen: { id: string; firstName: string; lastName: string; uniqueNumber: string; phone: string | null };
  let entityLabel: string;
  let obligationWhere: { businessId: string } | { marketStallId: string };
  let arrondissementId: string;

  if (qr.entityType === "BUSINESS") {
    const business = await prisma.business.findUnique({ where: { id: qr.entityId }, include: { owner: true } });
    if (!business) throw new ApiError(404, "Commerce introuvable.");
    citizen = business.owner;
    entityLabel = business.name;
    obligationWhere = { businessId: business.id };
    arrondissementId = business.arrondissementId;
  } else if (qr.entityType === "MARKET_STALL") {
    const stall = await prisma.marketStall.findUnique({ where: { id: qr.entityId }, include: { occupant: true, market: true } });
    if (!stall) throw new ApiError(404, "Emplacement introuvable.");
    if (!stall.occupant) throw new ApiError(400, "Cet emplacement n'a pas d'occupant enregistre.");
    citizen = stall.occupant;
    entityLabel = `${stall.market.name} — ${stall.code}`;
    obligationWhere = { marketStallId: stall.id };
    arrondissementId = stall.market.arrondissementId;
  } else {
    throw new ApiError(400, "Type d'entite QR invalide.");
  }

  if (qr.status !== "ACTIVE") {
    await detectInvalidQrScan(qr.id, entityLabel, arrondissementId);
    throw new ApiError(400, "Ce QR n'est plus valide.");
  }

  if (!canAccessArrondissement(actor, arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const obligations = await prisma.obligationPaiement.findMany({
    where: { ...obligationWhere, status: { in: OPEN_OBLIGATION_STATUSES } },
    include: { tarif: true },
    orderBy: { dueDate: "asc" },
  });

  await detectQrScanVolumeAnomaly(qr.id, entityLabel, arrondissementId);

  return {
    entityType: qr.entityType as QrEntityType,
    entityLabel,
    citizen: { id: citizen.id, firstName: citizen.firstName, lastName: citizen.lastName, uniqueNumber: citizen.uniqueNumber, phone: citizen.phone },
    obligations: obligations.map(withBalance),
  };
}

async function buildScanResult(
  qr: { status: string },
  info: {
    entityType: QrEntityType;
    reference: string;
    name: string;
    arrondissementName: string;
    quartierName?: string;
    operatingStatus: string;
    obligationWhere: { businessId: string } | { marketStallId: string };
  },
): Promise<QrScanResult> {
  const obligations = await prisma.obligationPaiement.findMany({
    where: { ...info.obligationWhere, status: { in: OPEN_OBLIGATION_STATUSES } },
    orderBy: { dueDate: "asc" },
  });
  const withBal = obligations.map(withBalance);

  return {
    found: true,
    valid: qr.status === "ACTIVE",
    status: qr.status,
    entityType: info.entityType,
    reference: info.reference,
    name: info.name,
    arrondissementName: info.arrondissementName,
    quartierName: info.quartierName,
    operatingStatus: info.operatingStatus,
    outstanding: {
      total: withBal.reduce((sum, o) => sum + o.balance, 0),
      obligations: withBal.map((o) => ({ id: o.id, number: o.number, period: o.period, balance: o.balance, dueDate: o.dueDate })),
    },
  };
}
