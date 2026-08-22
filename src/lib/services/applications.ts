import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import {
  issueBirthCertificate,
  issueMarriageCertificate,
  issueDeathCertificate,
} from "@/lib/services/certificates";

type CitizenAccountWithCitizen = {
  id: string;
  citizenId: string;
  citizen: { arrondissementId: string };
};

export async function listMyApplications(account: CitizenAccountWithCitizen) {
  return prisma.application.findMany({
    where: { citizenAccountId: account.id },
    include: { resultCertificate: true },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateApplicationInput = {
  type: "BIRTH_CERTIFICATE_COPY" | "MARRIAGE_CERTIFICATE_COPY" | "DEATH_CERTIFICATE_COPY";
  birthRecordId?: string;
  marriageId?: string;
  deathRecordId?: string;
};

// Le citoyen ne peut demander une copie que d'un acte qui LE concerne
// directement (verification d'appartenance, pas de confiance aveugle dans
// l'ID fourni par le client).
export async function createApplication(account: CitizenAccountWithCitizen, input: CreateApplicationInput) {
  if (input.type === "BIRTH_CERTIFICATE_COPY") {
    if (!input.birthRecordId) throw new ApiError(400, "Acte de naissance requis.");
    const record = await prisma.birthRecord.findUnique({ where: { id: input.birthRecordId } });
    if (!record || record.childId !== account.citizenId) throw new ApiError(403, "Cet acte ne vous concerne pas.");
  } else if (input.type === "MARRIAGE_CERTIFICATE_COPY") {
    if (!input.marriageId) throw new ApiError(400, "Mariage requis.");
    const record = await prisma.marriage.findUnique({ where: { id: input.marriageId } });
    if (!record || (record.husbandId !== account.citizenId && record.wifeId !== account.citizenId)) {
      throw new ApiError(403, "Ce mariage ne vous concerne pas.");
    }
  } else if (input.type === "DEATH_CERTIFICATE_COPY") {
    throw new ApiError(400, "Une demande de copie d'acte de deces doit etre faite par un proche habilite, en agence.");
  } else {
    throw new ApiError(400, "Type de demande invalide.");
  }

  const created = await prisma.application.create({
    data: {
      applicationNumber: generateRecordNumber("DEM"),
      citizenAccountId: account.id,
      type: input.type,
      birthRecordId: input.birthRecordId,
      marriageId: input.marriageId,
      arrondissementId: account.citizen.arrondissementId,
    },
  });

  return created;
}

export async function listApplicationsForStaff(user: CurrentUser) {
  if (!can(user, "applications", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.application.findMany({
    where: recordScopeWhere(user),
    include: { citizenAccount: { include: { citizen: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function approveApplication(actor: CurrentUser, id: string) {
  if (!can(actor, "applications", "approve")) throw new ApiError(403, "Permission insuffisante.");
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) throw new ApiError(404, "Demande introuvable.");
  if (application.status !== "SUBMITTED" && application.status !== "IN_REVIEW") {
    throw new ApiError(400, "Cette demande a deja ete traitee.");
  }

  let certificate;
  if (application.type === "BIRTH_CERTIFICATE_COPY" && application.birthRecordId) {
    certificate = await issueBirthCertificate(actor, application.birthRecordId);
  } else if (application.type === "MARRIAGE_CERTIFICATE_COPY" && application.marriageId) {
    certificate = await issueMarriageCertificate(actor, application.marriageId);
  } else if (application.type === "DEATH_CERTIFICATE_COPY" && application.deathRecordId) {
    certificate = await issueDeathCertificate(actor, application.deathRecordId);
  } else {
    throw new ApiError(400, "Demande mal formee.");
  }

  const updated = await prisma.application.update({
    where: { id },
    data: {
      status: "COMPLETED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
      resultCertificateId: certificate.id,
    },
  });

  await prisma.notification.create({
    data: {
      citizenAccountId: application.citizenAccountId,
      title: "Demande approuvee",
      message: `Votre demande ${application.applicationNumber} a ete approuvee. Votre document (${certificate.documentNumber}) est disponible.`,
    },
  });

  await logAudit({
    user: actor,
    action: "APPROVE",
    module: "applications",
    entityType: "Application",
    entityId: id,
    newValue: { status: "COMPLETED", certificateId: certificate.id },
  });

  return updated;
}

export async function rejectApplication(actor: CurrentUser, id: string, reason: string) {
  if (!can(actor, "applications", "reject")) throw new ApiError(403, "Permission insuffisante.");
  if (!reason?.trim()) throw new ApiError(400, "Un motif est requis.");
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) throw new ApiError(404, "Demande introuvable.");
  if (application.status !== "SUBMITTED" && application.status !== "IN_REVIEW") {
    throw new ApiError(400, "Cette demande a deja ete traitee.");
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status: "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: reason.trim() },
  });

  await prisma.notification.create({
    data: {
      citizenAccountId: application.citizenAccountId,
      title: "Demande rejetee",
      message: `Votre demande ${application.applicationNumber} a ete rejetee. Motif : ${reason.trim()}`,
    },
  });

  await logAudit({
    user: actor,
    action: "REJECT",
    module: "applications",
    entityType: "Application",
    entityId: id,
    newValue: { status: "REJECTED", reason },
  });

  return updated;
}
