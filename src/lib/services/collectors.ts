import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateAgentMatricule } from "@/lib/ids";

const STATUSES = ["ACTIF", "SUSPENDU", "INACTIF"];
const ZONE_TYPES = ["QUARTIER", "MARCHE"];

// Comptes User de l'arrondissement de l'acteur (ou tous, en portee globale)
// pas encore rattaches a une fiche agent collecteur — alimente le
// formulaire de creation (section 12 : "utilisateur lie").
export async function listEligibleUsers(user: CurrentUser) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      agentCollecteur: null,
      ...(user.hasGlobalScope ? {} : { arrondissements: { some: { arrondissementId: { in: user.arrondissementIds } } } }),
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function listCollectors(user: CurrentUser) {
  return prisma.agentCollecteur.findMany({
    where: recordScopeWhere(user),
    include: {
      user: true,
      arrondissement: true,
      affectations: { where: { isActive: true }, include: { quartier: true, market: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCollector(user: CurrentUser, id: string) {
  const agent = await prisma.agentCollecteur.findUnique({
    where: { id },
    include: {
      user: true,
      arrondissement: true,
      affectations: { include: { quartier: true, market: true }, orderBy: { startDate: "desc" } },
      payments: { orderBy: { paymentDate: "desc" }, take: 20 },
    },
  });
  if (!agent) throw new ApiError(404, "Agent introuvable.");
  if (!canAccessArrondissement(user, agent.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");
  return agent;
}

// Cree l'agent collecteur en le rattachant a un compte User EXISTANT
// (section 12 : "utilisateur lie") — pas de realm d'authentification
// separe : l'agent se connecte comme n'importe quel agent SIGEC-SM.
export async function createCollector(actor: CurrentUser, input: { userId: string; phone?: string; photoUrl?: string; arrondissementId: string }) {
  if (!can(actor, "collectors", "create")) throw new ApiError(403, "Permission insuffisante.");
  if (!input.userId) throw new ApiError(400, "Un compte utilisateur est requis.");
  if (!canAccessArrondissement(actor, input.arrondissementId)) throw new ApiError(403, "Arrondissement hors de votre perimetre.");

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new ApiError(404, "Utilisateur introuvable.");

  const existing = await prisma.agentCollecteur.findUnique({ where: { userId: input.userId } });
  if (existing) throw new ApiError(409, "Ce compte est deja rattache a une fiche agent collecteur.");

  const created = await prisma.agentCollecteur.create({
    data: {
      matricule: generateAgentMatricule(),
      userId: input.userId,
      phone: input.phone?.trim(),
      photoUrl: input.photoUrl?.trim(),
      arrondissementId: input.arrondissementId,
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "collectors",
    entityType: "AgentCollecteur",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { matricule: created.matricule, userId: created.userId },
  });
  return created;
}

export async function setCollectorStatus(actor: CurrentUser, id: string, status: string) {
  if (!can(actor, "collectors", "edit")) throw new ApiError(403, "Permission insuffisante.");
  if (!STATUSES.includes(status)) throw new ApiError(400, "Statut invalide.");
  const before = await prisma.agentCollecteur.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Agent introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const updated = await prisma.agentCollecteur.update({ where: { id }, data: { status } });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "collectors",
    entityType: "AgentCollecteur",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status },
  });
  return updated;
}

// Affecte un agent a une zone (quartier ou marche precis). Historise :
// l'affectation active precedente (le cas echeant, sur la meme zoneType)
// n'est jamais supprimee, elle est cloturee (section 12).
export async function assignZone(actor: CurrentUser, input: { agentId: string; zoneType: string; quartierId?: string; marketId?: string }) {
  if (!can(actor, "collectors", "assign")) throw new ApiError(403, "Permission insuffisante.");
  if (!ZONE_TYPES.includes(input.zoneType)) throw new ApiError(400, "Type de zone invalide.");
  if (input.zoneType === "QUARTIER" && !input.quartierId) throw new ApiError(400, "Quartier requis.");
  if (input.zoneType === "MARCHE" && !input.marketId) throw new ApiError(400, "Marche requis.");

  const agent = await prisma.agentCollecteur.findUnique({ where: { id: input.agentId } });
  if (!agent) throw new ApiError(404, "Agent introuvable.");
  if (!canAccessArrondissement(actor, agent.arrondissementId)) throw new ApiError(403, "Hors de votre perimetre.");

  const created = await prisma.$transaction(async (tx) => {
    await tx.agentAffectation.updateMany({
      where: { agentId: input.agentId, zoneType: input.zoneType, isActive: true },
      data: { isActive: false, endDate: new Date() },
    });
    return tx.agentAffectation.create({
      data: {
        agentId: input.agentId,
        zoneType: input.zoneType,
        quartierId: input.zoneType === "QUARTIER" ? input.quartierId : null,
        marketId: input.zoneType === "MARCHE" ? input.marketId : null,
        createdById: actor.id,
      },
    });
  });

  await logAudit({
    user: actor,
    action: "ASSIGN",
    module: "collectors",
    entityType: "AgentAffectation",
    entityId: created.id,
    arrondissementId: agent.arrondissementId,
    newValue: { agentId: input.agentId, zoneType: input.zoneType, quartierId: input.quartierId, marketId: input.marketId },
  });
  return created;
}

// Verifie qu'un agent opere dans une zone qui lui est bien affectee
// (section "controle anti-fraude" : collecte hors zone). Utilise par
// recordPayment() quand le paiement est rattache a un agent.
export async function isAgentAssignedToZone(agentId: string, quartierId?: string | null, marketId?: string | null) {
  if (!quartierId && !marketId) return true;
  const count = await prisma.agentAffectation.count({
    where: {
      agentId,
      isActive: true,
      OR: [quartierId ? { quartierId } : undefined, marketId ? { marketId } : undefined].filter(Boolean) as object[],
    },
  });
  return count > 0;
}
