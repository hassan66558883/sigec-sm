import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { detectCashDiscrepancy } from "@/lib/services/fraud";

// Agents actifs du perimetre de l'acteur qui n'ont pas deja une caisse
// ouverte — alimente le formulaire d'ouverture.
export async function listAgentsWithoutOpenCaisse(user: CurrentUser) {
  return prisma.agentCollecteur.findMany({
    where: { status: "ACTIF", ...recordScopeWhere(user), caisses: { none: { status: "OUVERTE" } } },
    include: { user: true },
    orderBy: { matricule: "asc" },
  });
}

// Caisses cloturees sans versement associe — alimente le formulaire de
// remise (section 21).
export async function listCaissesAwaitingVersement(user: CurrentUser) {
  return prisma.cashRegister.findMany({
    where: { status: "CLOTUREE", versements: { none: {} }, ...recordScopeWhere(user) },
    include: { agent: { include: { user: true } } },
    orderBy: { closedAt: "desc" },
  });
}

export async function listCashRegisters(user: CurrentUser) {
  return prisma.cashRegister.findMany({
    where: recordScopeWhere(user),
    include: { agent: { include: { user: true } }, arrondissement: true, _count: { select: { payments: true } } },
    orderBy: { openedAt: "desc" },
    take: 100,
  });
}

export async function getCashRegister(user: CurrentUser, id: string) {
  const caisse = await prisma.cashRegister.findUnique({
    where: { id },
    include: { agent: { include: { user: true } }, arrondissement: true, payments: { orderBy: { paymentDate: "desc" } } },
  });
  if (!caisse) throw new ApiError(404, "Caisse introuvable.");
  if (!canAccessArrondissement(user, caisse.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return caisse;
}

// Ouverture de caisse (section 20). Un agent ne peut avoir qu'une seule
// caisse OUVERTE a la fois — evite de disperser ses collectes entre
// plusieurs sessions actives simultanement.
export async function openCashRegister(actor: CurrentUser, agentId: string) {
  if (!can(actor, "caisses", "create")) throw new ApiError(403, "Permission insuffisante.");
  const agent = await prisma.agentCollecteur.findUnique({ where: { id: agentId } });
  if (!agent || agent.status !== "ACTIF") throw new ApiError(400, "Agent invalide ou inactif.");
  if (!canAccessArrondissement(actor, agent.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const alreadyOpen = await prisma.cashRegister.findFirst({ where: { agentId, status: "OUVERTE" } });
  if (alreadyOpen) throw new ApiError(409, "Cet agent a deja une caisse ouverte.");

  const created = await prisma.cashRegister.create({
    data: {
      number: generateRecordNumber("CAI"),
      agentId,
      arrondissementId: agent.arrondissementId,
      openedById: actor.id,
    },
  });

  await logAudit({
    user: actor,
    action: "CAISSE_OUVERTURE",
    module: "caisses",
    entityType: "CashRegister",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { number: created.number, agentId },
  });
  return created;
}

// Cloture (section 20) : fige expectedAmount (somme des paiements ESPECES
// de la session, jamais recalculee ensuite) et compare au montant declare
// par l'agent. Un ecart genere automatiquement une FraudAlert.
export async function closeCashRegister(actor: CurrentUser, id: string, declaredAmount: number) {
  if (!can(actor, "caisses", "edit")) throw new ApiError(403, "Permission insuffisante.");
  if (declaredAmount === undefined || declaredAmount === null || declaredAmount < 0) {
    throw new ApiError(400, "Montant declare invalide.");
  }
  const caisse = await prisma.cashRegister.findUnique({ where: { id } });
  if (!caisse) throw new ApiError(404, "Caisse introuvable.");
  if (!canAccessArrondissement(actor, caisse.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  if (caisse.status !== "OUVERTE") throw new ApiError(400, "Cette caisse n'est pas ouverte.");

  const cashAgg = await prisma.payment.aggregate({
    where: { caisseId: id, paymentMethod: "ESPECES", status: "PAID" },
    _sum: { amount: true },
  });
  const expectedAmount = cashAgg._sum.amount ?? 0;
  const discrepancy = declaredAmount - expectedAmount;

  const updated = await prisma.cashRegister.update({
    where: { id },
    data: { status: "CLOTUREE", closedAt: new Date(), closedById: actor.id, expectedAmount, declaredAmount, discrepancy },
  });

  await logAudit({
    user: actor,
    action: "CAISSE_CLOTURE",
    module: "caisses",
    entityType: "CashRegister",
    entityId: id,
    arrondissementId: caisse.arrondissementId,
    newValue: { expectedAmount, declaredAmount, discrepancy },
  });

  if (discrepancy !== 0) {
    await detectCashDiscrepancy(id, discrepancy, caisse.arrondissementId, caisse.agentId);
  }

  return updated;
}
