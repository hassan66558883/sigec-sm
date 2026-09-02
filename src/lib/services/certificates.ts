import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, canAccessArrondissement, recordScopeWhere } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber, generateVerificationToken } from "@/lib/ids";
import { periodBounds } from "@/lib/date-buckets";

// KPI d'en-tete (Certificats delivres, Phase 2) — base sur issuedAt (date de
// delivrance), pas createdAt, memes conventions que getCivilStatusTrend.
export async function getCertificatesPeriodStats(user: CurrentUser) {
  const scope = { ...recordScopeWhere(user), status: "VALID" as const };
  const { startOfDay, startOfWeek, startOfMonth, startOfYear } = periodBounds();
  const [today, week, month, year] = await Promise.all([
    prisma.certificate.count({ where: { ...scope, issuedAt: { gte: startOfDay } } }),
    prisma.certificate.count({ where: { ...scope, issuedAt: { gte: startOfWeek } } }),
    prisma.certificate.count({ where: { ...scope, issuedAt: { gte: startOfMonth } } }),
    prisma.certificate.count({ where: { ...scope, issuedAt: { gte: startOfYear } } }),
  ]);
  return { today, week, month, year };
}

export async function listCertificateTypes() {
  return prisma.certificateType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function listCertificates(user: CurrentUser, search?: string) {
  return prisma.certificate.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(search ? { documentNumber: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { certificateType: true, citizen: true, arrondissement: true },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });
}

type IssueParams = {
  typeCode: string;
  arrondissementId: string;
  citizenId?: string | null;
  birthRecordId?: string | null;
  recognitionId?: string | null;
  marriageId?: string | null;
  divorceId?: string | null;
  deathRecordId?: string | null;
  urbanPlanningCaseId?: string | null;
};

async function createCertificateRecord(actor: CurrentUser, params: IssueParams) {
  if (!can(actor, "certificates", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!canAccessArrondissement(actor, params.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  const type = await prisma.certificateType.findUnique({ where: { code: params.typeCode } });
  if (!type || !type.isActive) throw new ApiError(400, "Type de document invalide.");

  const created = await prisma.certificate.create({
    data: {
      documentNumber: generateRecordNumber("DOC"),
      qrToken: generateVerificationToken(),
      certificateTypeId: type.id,
      citizenId: params.citizenId ?? null,
      birthRecordId: params.birthRecordId ?? null,
      recognitionId: params.recognitionId ?? null,
      marriageId: params.marriageId ?? null,
      divorceId: params.divorceId ?? null,
      deathRecordId: params.deathRecordId ?? null,
      urbanPlanningCaseId: params.urbanPlanningCaseId ?? null,
      arrondissementId: params.arrondissementId,
      issuedById: actor.id,
    },
    include: { certificateType: true },
  });

  await logAudit({
    user: actor,
    action: "SIGN",
    module: "certificates",
    entityType: "Certificate",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { documentNumber: created.documentNumber, type: type.code },
  });

  return created;
}

// Un certificat ne peut etre emis que si l'acte sous-jacent a ete
// officiellement enregistre (workflow section 17) — jamais directement par
// n'importe quel agent depuis une simple declaration.
export async function issueBirthCertificate(actor: CurrentUser, birthRecordId: string) {
  const record = await prisma.birthRecord.findUnique({ where: { id: birthRecordId } });
  if (!record) throw new ApiError(404, "Acte de naissance introuvable.");
  if (record.status !== "REGISTERED") throw new ApiError(400, "L'acte doit d'abord etre enregistre.");
  return createCertificateRecord(actor, {
    typeCode: "BIRTH_CERTIFICATE",
    arrondissementId: record.arrondissementId,
    citizenId: record.childId,
    birthRecordId: record.id,
  });
}

export async function issueRecognitionCertificate(actor: CurrentUser, recognitionId: string) {
  const record = await prisma.recognition.findUnique({ where: { id: recognitionId } });
  if (!record) throw new ApiError(404, "Reconnaissance introuvable.");
  if (record.status !== "VALIDATED") throw new ApiError(400, "La reconnaissance doit d'abord etre validee.");
  return createCertificateRecord(actor, {
    typeCode: "RECOGNITION_CERTIFICATE",
    arrondissementId: record.arrondissementId,
    citizenId: record.childId,
    recognitionId: record.id,
  });
}

export async function issueMarriageCertificate(actor: CurrentUser, marriageId: string) {
  const record = await prisma.marriage.findUnique({ where: { id: marriageId } });
  if (!record) throw new ApiError(404, "Mariage introuvable.");
  if (record.status !== "VALID") throw new ApiError(400, "Le mariage doit d'abord etre valide.");
  return createCertificateRecord(actor, {
    typeCode: "MARRIAGE_CERTIFICATE",
    arrondissementId: record.arrondissementId,
    marriageId: record.id,
  });
}

export async function issueDeathCertificate(actor: CurrentUser, deathRecordId: string) {
  const record = await prisma.deathRecord.findUnique({ where: { id: deathRecordId } });
  if (!record) throw new ApiError(404, "Acte de deces introuvable.");
  if (record.status !== "REGISTERED") throw new ApiError(400, "L'acte doit d'abord etre enregistre.");
  return createCertificateRecord(actor, {
    typeCode: "DEATH_CERTIFICATE",
    arrondissementId: record.arrondissementId,
    citizenId: record.deceasedId,
    deathRecordId: record.id,
  });
}

// Document officiel d'un permis (section 9) : uniquement apres decision
// APPROVED du dossier d'urbanisme (workflow controle par urbanism.ts).
export async function issueUrbanPlanningCertificate(actor: CurrentUser, caseId: string) {
  const record = await prisma.urbanPlanningCase.findUnique({ where: { id: caseId } });
  if (!record) throw new ApiError(404, "Dossier d'urbanisme introuvable.");
  if (record.status !== "APPROVED") throw new ApiError(400, "Le dossier doit d'abord etre approuve.");
  const typeCode = record.type === "DEMOLITION_PERMIT" ? "DEMOLITION_PERMIT" : "BUILDING_PERMIT";
  return createCertificateRecord(actor, {
    typeCode,
    arrondissementId: record.arrondissementId,
    citizenId: record.applicantId,
    urbanPlanningCaseId: record.id,
  });
}

export async function revokeCertificate(actor: CurrentUser, id: string, reason: string) {
  if (!can(actor, "certificates", "revoke")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const before = await prisma.certificate.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Document introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Document hors de votre perimetre.");
  }
  if (before.status === "REVOKED") throw new ApiError(400, "Ce document est deja revoque.");

  const updated = await prisma.certificate.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date(), revokedById: actor.id, revokedReason: reason.trim() },
  });

  await logAudit({
    user: actor,
    action: "REVOKE",
    module: "certificates",
    entityType: "Certificate",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status, reason },
  });

  return updated;
}

// Verification PUBLIQUE (section 16) : aucune authentification requise,
// aucune donnee personnelle inutile exposee (jamais le nom du citoyen).
export async function verifyCertificatePublic(qrToken: string) {
  const cert = await prisma.certificate.findUnique({
    where: { qrToken },
    include: { certificateType: true },
  });
  if (!cert) return { found: false as const };

  return {
    found: true as const,
    valid: cert.status === "VALID",
    status: cert.status,
    typeName: cert.certificateType.name,
    documentNumber: cert.documentNumber,
    issuedAt: cert.issuedAt,
    authority: cert.authority,
  };
}
