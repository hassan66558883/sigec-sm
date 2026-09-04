import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

// Utilisee a la fois par la page de liste /admin/households ET par
// src/app/api/households/route.ts (GET) — signature/forme de retour
// (tableau simple) volontairement inchangee ici pour ne pas casser cet
// appelant. La pagination reelle de l'ecran de liste vit dans
// listHouseholdsPage() ci-dessous, une fonction dediee.
export async function listHouseholds(user: CurrentUser) {
  return prisma.household.findMany({
    where: recordScopeWhere(user),
    include: { arrondissement: true, quartier: true, head: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/households uniquement : avant ce changement, les menages au-dela
// des 100 premiers (par date de creation) n'etaient jamais accessibles,
// quelle que soit la page cliquee dans le tableau (voir audit performance
// 2026-09-02) — `listHouseholds()` ci-dessus plafonnait a `take: 100` sans
// `skip`.
export async function listHouseholdsPage(user: CurrentUser, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.household.findMany({
      where,
      include: { arrondissement: true, quartier: true, head: true, _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.household.count({ where }),
  ]);
  return { rows, total, page, pageSize };
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
