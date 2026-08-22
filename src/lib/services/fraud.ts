import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { isAgentAssignedToZone } from "@/lib/services/collectors";

// Seuils configurables (section 23 : "Les seuils doivent etre
// configurables") — stockes dans SystemSetting, valeurs par defaut sinon.
// Ce sont des points de depart raisonnables, pas un bareme officiel (regle 39).
const DEFAULT_THRESHOLDS = {
  cancellationsMedium: 3,
  cancellationsHigh: 5,
  cancellationsCritical: 10,
  cashDiscrepancyMedium: 5000, // FCFA
  cashDiscrepancyHigh: 20000,
  volumeWindowMinutes: 10,
  volumeMedium: 8,
  volumeHigh: 15,
  offHoursStart: 6, // 06:00
  offHoursEnd: 20, // 20:00
  riskAlertsMedium: 1,
  riskAlertsHigh: 3,
  riskAlertsCritical: 5,
};

async function getThresholds() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "fraud_thresholds" } });
  if (!setting) return DEFAULT_THRESHOLDS;
  return { ...DEFAULT_THRESHOLDS, ...(setting.value as Partial<typeof DEFAULT_THRESHOLDS>) };
}

type RaiseAlertInput = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  agentId?: string | null;
  paymentId?: string | null;
  caisseId?: string | null;
  arrondissementId?: string | null;
};

// Point d'entree unique pour toute creation d'alerte — garantit qu'elle est
// systematiquement journalisee (section 24), jamais silencieuse.
async function raiseFraudAlert(input: RaiseAlertInput) {
  const alert = await prisma.fraudAlert.create({
    data: {
      type: input.type,
      severity: input.severity,
      description: input.description,
      agentId: input.agentId ?? null,
      paymentId: input.paymentId ?? null,
      caisseId: input.caisseId ?? null,
      arrondissementId: input.arrondissementId ?? null,
    },
  });
  await logAudit({
    user: null,
    action: "FRAUD_ALERT",
    module: "fraud",
    entityType: "FraudAlert",
    entityId: alert.id,
    arrondissementId: input.arrondissementId ?? null,
    newValue: { type: input.type, severity: input.severity, description: input.description },
    result: "FAILURE",
  });
  return alert;
}

// --- Detecteurs (section 22), tous non bloquants : ils journalisent une
// alerte, ils n'empechent jamais l'operation en cours. ------------------

export async function detectExcessiveCancellations(agentId: string | null) {
  if (!agentId) return;
  const thresholds = await getThresholds();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const count = await prisma.paymentCancellation.count({
    where: { payment: { agentId }, createdAt: { gte: since } },
  });
  if (count < thresholds.cancellationsMedium) return;
  const severity = count >= thresholds.cancellationsCritical ? "CRITICAL" : count >= thresholds.cancellationsHigh ? "HIGH" : "MEDIUM";
  const agent = await prisma.agentCollecteur.findUnique({ where: { id: agentId } });
  await raiseFraudAlert({
    type: "EXCESSIVE_CANCELLATIONS",
    severity,
    description: `Agent ${agent?.matricule ?? agentId} : ${count} annulations sur 30 jours.`,
    agentId,
    arrondissementId: agent?.arrondissementId,
  });
}

export async function detectCashDiscrepancy(caisseId: string, discrepancy: number, arrondissementId: string, agentId: string) {
  const thresholds = await getThresholds();
  const abs = Math.abs(discrepancy);
  if (abs === 0) return;
  const severity = abs >= thresholds.cashDiscrepancyHigh ? "HIGH" : abs >= thresholds.cashDiscrepancyMedium ? "MEDIUM" : "LOW";
  await raiseFraudAlert({
    type: "CASH_DISCREPANCY",
    severity,
    description: `Ecart de caisse de ${discrepancy.toLocaleString("fr-FR")} FCFA a la cloture.`,
    caisseId,
    agentId,
    arrondissementId,
  });
}

// Collecte hors zone (section 22.F) : le paiement porte un agent + une zone
// (marche via marketStallId) qui ne correspond a aucune affectation active.
export async function detectOutOfZone(paymentId: string, agentId: string, quartierId?: string | null, marketId?: string | null) {
  if (!quartierId && !marketId) return;
  const assigned = await isAgentAssignedToZone(agentId, quartierId, marketId);
  if (assigned) return;
  const agent = await prisma.agentCollecteur.findUnique({ where: { id: agentId } });
  await raiseFraudAlert({
    type: "OUT_OF_ZONE",
    severity: "MEDIUM",
    description: `Collecte enregistree hors de la zone affectee a l'agent ${agent?.matricule ?? agentId}.`,
    agentId,
    paymentId,
    arrondissementId: agent?.arrondissementId,
  });
}

export async function detectSuspiciousVolume(agentId: string) {
  const thresholds = await getThresholds();
  const since = new Date(Date.now() - thresholds.volumeWindowMinutes * 60 * 1000);
  const count = await prisma.payment.count({ where: { agentId, createdAt: { gte: since } } });
  if (count < thresholds.volumeMedium) return;
  const severity = count >= thresholds.volumeHigh ? "HIGH" : "MEDIUM";
  const agent = await prisma.agentCollecteur.findUnique({ where: { id: agentId } });
  await raiseFraudAlert({
    type: "SUSPICIOUS_VOLUME",
    severity,
    description: `${count} paiements enregistres par le meme agent en ${thresholds.volumeWindowMinutes} minutes.`,
    agentId,
    arrondissementId: agent?.arrondissementId,
  });
}

export async function detectOffHours(paymentId: string, agentId: string | null, paymentDate: Date, arrondissementId: string | null) {
  if (!agentId) return;
  const thresholds = await getThresholds();
  const hour = paymentDate.getHours();
  if (hour >= thresholds.offHoursStart && hour < thresholds.offHoursEnd) return;
  await raiseFraudAlert({
    type: "OFF_HOURS",
    severity: "LOW",
    description: `Paiement enregistre hors plage horaire habituelle (${hour}h).`,
    agentId,
    paymentId,
    arrondissementId,
  });
}

// Filet de securite pour double paiement / double reçu (regles absolues #2
// et #5) : la contrainte d'unicite en base (Receipt.number/qrToken,
// MobileMoneyTransaction.externalReference) est la premiere ligne de
// defense — si une tentative de doublon la percute quand meme, on la
// journalise en CRITICAL plutot que de la laisser remonter comme une
// simple erreur 500 anonyme.
export async function raiseDuplicateAlert(type: "DOUBLE_PAYMENT" | "DOUBLE_RECEIPT", description: string, arrondissementId?: string | null) {
  await raiseFraudAlert({ type, severity: "CRITICAL", description, arrondissementId });
}

// Score de risque agent (section 23), base sur les alertes OUVERTES : le
// nombre d'alertes ouvertes traduit un risque cumule, pas un seul compteur.
export async function getAgentRiskScore(agentId: string): Promise<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> {
  const thresholds = await getThresholds();
  const count = await prisma.fraudAlert.count({ where: { agentId, status: "OUVERTE" } });
  if (count >= thresholds.riskAlertsCritical) return "CRITICAL";
  if (count >= thresholds.riskAlertsHigh) return "HIGH";
  if (count >= thresholds.riskAlertsMedium) return "MEDIUM";
  return "LOW";
}

export async function listFraudAlerts(user: CurrentUser, filters?: { status?: string; severity?: string }) {
  return prisma.fraudAlert.findMany({
    where: {
      ...recordScopeWhere(user),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.severity ? { severity: filters.severity } : {}),
    },
    include: { agent: { include: { user: true } }, payment: true, caisse: true, arrondissement: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function resolveFraudAlert(actor: CurrentUser, id: string, resolutionNotes: string, status: "RESOLUE" | "IGNOREE") {
  if (!can(actor, "fraud", "resolve")) throw new ApiError(403, "Permission insuffisante.");
  if (!resolutionNotes?.trim()) throw new ApiError(400, "Une note de resolution est requise.");
  const before = await prisma.fraudAlert.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Alerte introuvable.");

  const updated = await prisma.fraudAlert.update({
    where: { id },
    data: { status, resolvedById: actor.id, resolvedAt: new Date(), resolutionNotes: resolutionNotes.trim() },
  });

  await logAudit({
    user: actor,
    action: "FRAUD_ALERT_RESOLVE",
    module: "fraud",
    entityType: "FraudAlert",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: updated.status, resolutionNotes },
  });
  return updated;
}
