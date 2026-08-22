import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { recordScopeWhere } from "@/lib/rbac";

// Vision d'ensemble du module "recettes municipales" pour les tableaux de
// bord (section 28/29/30) : uniquement des compteurs/agregations, jamais de
// valeur codee en dur — toujours filtree par recordScopeWhere() comme
// n'importe quel autre module.
export async function getMunicipalRevenueOverview(user: CurrentUser) {
  const scope = recordScopeWhere(user);

  const [citizens, businesses, markets, marketStalls, activeAgents, unpaidAgg, unpaidCount, openAlerts] = await Promise.all([
    prisma.citizen.count({ where: scope }),
    prisma.business.count({ where: scope }),
    prisma.market.count({ where: scope }),
    prisma.marketStall.count({ where: { market: scope } }),
    prisma.agentCollecteur.count({ where: { ...scope, status: "ACTIF" } }),
    prisma.obligationPaiement.aggregate({
      where: { ...scope, status: { in: ["A_PAYER", "PARTIELLEMENT_PAYE", "EN_RETARD"] } },
      _sum: { initialAmount: true, paidAmount: true },
    }),
    prisma.obligationPaiement.count({ where: { ...scope, status: { in: ["A_PAYER", "PARTIELLEMENT_PAYE", "EN_RETARD"] } } }),
    prisma.fraudAlert.count({ where: { ...scope, status: "OUVERTE" } }),
  ]);

  const unpaidTotal = (unpaidAgg._sum.initialAmount ?? 0) - (unpaidAgg._sum.paidAmount ?? 0);

  return {
    citizens,
    businesses,
    markets,
    marketStalls,
    activeAgents,
    unpaidCount,
    unpaidTotal,
    openFraudAlerts: openAlerts,
  };
}
