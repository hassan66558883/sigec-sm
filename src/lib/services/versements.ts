import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { detectCashDiscrepancy } from "@/lib/services/fraud";

// Utilisee a la fois par la page de liste des versements ET par
// /api/versements (consommateur externe qui veut le lot complet, pas une
// page) — signature/forme de retour (tableau simple) volontairement
// inchangee ici pour ne pas casser cet appelant. La pagination reelle de
// l'ecran de liste vit dans listVersementsPage() ci-dessous.
export async function listVersements(user: CurrentUser) {
  return prisma.versement.findMany({
    where: recordScopeWhere(user),
    include: { agent: { include: { user: true } }, caisse: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const VERSEMENTS_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/versements uniquement (voir citizens.ts:listCitizensPage pour le
// meme constat et la meme justification — audit performance 2026-09-02).
// listVersements() ci-dessus reste inchangee : encore utilisee telle quelle
// par /api/versements, qui veut le lot complet (jusqu'a 100 lignes), pas
// une page.
export async function listVersementsPage(user: CurrentUser, page = 1, pageSize = VERSEMENTS_PAGE_SIZE) {
  const where = recordScopeWhere(user);
  const [rows, total] = await Promise.all([
    prisma.versement.findMany({
      where,
      include: { agent: { include: { user: true } }, caisse: true, arrondissement: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.versement.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// Remise des especes d'une caisse cloturee (section 21) — le montant
// attendu vient de la caisse elle-meme (expectedAmount fige a sa cloture),
// jamais ressaisi librement.
export async function createVersement(actor: CurrentUser, input: { caisseId: string; remittedAmount: number; justification?: string }) {
  if (!can(actor, "versements", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (input.remittedAmount === undefined || input.remittedAmount === null || input.remittedAmount < 0) {
    throw new ApiError(400, "Montant remis invalide.");
  }
  const caisse = await prisma.cashRegister.findUnique({ where: { id: input.caisseId } });
  if (!caisse) throw new ApiError(404, "Caisse introuvable.");
  if (caisse.status !== "CLOTUREE") throw new ApiError(400, "La caisse doit d'abord etre cloturee.");
  if (!canAccessArrondissement(actor, caisse.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const existing = await prisma.versement.findFirst({ where: { caisseId: input.caisseId } });
  if (existing) throw new ApiError(409, "Un versement existe deja pour cette caisse.");

  const expectedAmount = caisse.expectedAmount ?? 0;
  const discrepancy = input.remittedAmount - expectedAmount;

  const created = await prisma.versement.create({
    data: {
      number: generateRecordNumber("VER"),
      agentId: caisse.agentId,
      caisseId: caisse.id,
      expectedAmount,
      remittedAmount: input.remittedAmount,
      discrepancy,
      justification: input.justification?.trim(),
      status: discrepancy === 0 ? "EN_ATTENTE" : "ECART",
      arrondissementId: caisse.arrondissementId,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "versements",
    entityType: "Versement",
    entityId: created.id,
    arrondissementId: caisse.arrondissementId,
    newValue: { number: created.number, expectedAmount, remittedAmount: input.remittedAmount, discrepancy },
  });

  if (discrepancy !== 0) {
    await detectCashDiscrepancy(caisse.id, discrepancy, caisse.arrondissementId, caisse.agentId);
  }

  return created;
}

// Validation superviseur (section 20 : "validation superviseur").
export async function validateVersement(actor: CurrentUser, id: string, approve: boolean) {
  if (!can(actor, "versements", "validate")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.versement.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Versement introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  if (before.status === "VALIDE" || before.status === "REJETE") throw new ApiError(400, "Ce versement a deja ete traite.");

  const updated = await prisma.versement.update({
    where: { id },
    data: { status: approve ? "VALIDE" : "REJETE", validatedById: actor.id, validatedAt: new Date() },
  });

  await logAudit({
    user: actor,
    action: approve ? "VERSEMENT_VALIDATION" : "VERSEMENT_REJET",
    module: "versements",
    entityType: "Versement",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });
  return updated;
}
