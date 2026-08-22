import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { issueUrbanPlanningCertificate } from "@/lib/services/certificates";

// Workflow (section 9) : Demande -> Verification/Instruction -> Controle ->
// Validation/Decision -> Document officiel.
// status: SUBMITTED -> UNDER_REVIEW -> INSPECTED -> APPROVED | REJECTED

export async function listUrbanCases(user: CurrentUser) {
  return prisma.urbanPlanningCase.findMany({
    where: recordScopeWhere(user),
    include: { parcel: true, applicant: true, arrondissement: true, certificates: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type SubmitUrbanCaseInput = {
  type: "BUILDING_PERMIT" | "DEMOLITION_PERMIT";
  parcelId: string;
  applicantId: string;
  description?: string;
  arrondissementId: string;
};

export async function submitUrbanCase(actor: CurrentUser, input: SubmitUrbanCaseInput) {
  if (!can(actor, "urbanism", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (input.type !== "BUILDING_PERMIT" && input.type !== "DEMOLITION_PERMIT") {
    throw new ApiError(400, "Type de demande invalide.");
  }
  if (!input.parcelId || !input.applicantId) throw new ApiError(400, "Parcelle et demandeur requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const created = await prisma.urbanPlanningCase.create({
    data: {
      caseNumber: generateRecordNumber("URB"),
      type: input.type,
      parcelId: input.parcelId,
      applicantId: input.applicantId,
      description: input.description?.trim(),
      arrondissementId: input.arrondissementId,
    },
  });

  await logAudit({ user: actor, action: "CREATE", module: "urbanism", entityType: "UrbanPlanningCase", entityId: created.id, newValue: { caseNumber: created.caseNumber } });
  return created;
}

async function transition(
  actor: CurrentUser,
  id: string,
  action: string,
  fromStatuses: string[],
  data: Record<string, unknown>,
) {
  if (!can(actor, "urbanism", action)) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.urbanPlanningCase.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Dossier introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  if (!fromStatuses.includes(before.status)) {
    throw new ApiError(400, `Le dossier doit etre dans l'etat ${fromStatuses.join(" ou ")} pour cette action.`);
  }
  const updated = await prisma.urbanPlanningCase.update({ where: { id }, data });
  await logAudit({
    user: actor,
    action: action.toUpperCase(),
    module: "urbanism",
    entityType: "UrbanPlanningCase",
    entityId: id,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });
  return updated;
}

// Verification/Instruction du dossier.
export async function reviewUrbanCase(actor: CurrentUser, id: string) {
  return transition(actor, id, "review", ["SUBMITTED"], { status: "UNDER_REVIEW" });
}

// Controle (inspection terrain).
export async function inspectUrbanCase(actor: CurrentUser, id: string, notes?: string) {
  return transition(actor, id, "inspect", ["UNDER_REVIEW"], {
    status: "INSPECTED",
    inspectedAt: new Date(),
    inspectionNotes: notes?.trim(),
  });
}

// Validation/Decision. En cas d'approbation, le document officiel (permis)
// est emis automatiquement — jamais genere par un simple agent hors
// workflow (section 17).
export async function decideUrbanCase(actor: CurrentUser, id: string, approve: boolean, notes?: string) {
  const updated = await transition(actor, id, "decide", ["INSPECTED"], {
    status: approve ? "APPROVED" : "REJECTED",
    decisionAt: new Date(),
    decisionById: actor.id,
    decisionNotes: notes?.trim(),
  });

  if (approve) {
    await issueUrbanPlanningCertificate(actor, id);
  }

  return updated;
}
