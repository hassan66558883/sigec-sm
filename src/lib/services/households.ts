import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

export async function listHouseholds(user: CurrentUser) {
  return prisma.household.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, quartier: true, head: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// Rapport (section 31) : contrairement a listHouseholds() ci-dessus (pour
// les ecrans admin, plafonnee a 100 lignes), un export doit refleter le
// perimetre complet — meme filtrage territorial, plafond plus haut par
// simple securite anti-abus.
export async function listHouseholdsForReport(user: CurrentUser) {
  return prisma.household.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, quartier: true, head: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

export type CreateHouseholdInput = {
  address?: string;
  arrondissementId: string;
  quartierId?: string | null;
  sectorId?: string | null;
  headCitizenId?: string | null;
};

export async function createHousehold(actor: CurrentUser, input: CreateHouseholdInput) {
  if (!can(actor, "households", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.arrondissementId) throw new ApiError(400, "Arrondissement requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) {
    throw new ApiError(403, "Arrondissement hors de votre perimetre.");
  }

  const created = await prisma.household.create({
    data: {
      code: generateRecordNumber("MEN"),
      address: input.address?.trim(),
      arrondissementId: input.arrondissementId,
      quartierId: input.quartierId || null,
      sectorId: input.sectorId || null,
      headCitizenId: input.headCitizenId || null,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "households",
    entityType: "Household",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { code: created.code },
  });

  return created;
}
