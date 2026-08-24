import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber, generateLicenseKey } from "@/lib/ids";

// Services commerciaux TECHNOTCHAD (editeur) — gestion des clients, produits,
// plans, abonnements et licences. Deliberement SANS aucun filtrage
// territorial (recordScopeWhere / arrondissementId) : ce n'est pas une donnee
// d'arrondissement municipal, c'est une donnee "client logiciel" au sens
// commercial. L'isolation avec les donnees metier SIGEC-SM est assuree par
// les permissions dediees "technotchad_*", jamais accordees au SUPER_ADMIN
// municipal (voir l'exclusion explicite dans prisma/seed.ts).

export async function listTechnoClients(actor: CurrentUser) {
  if (!can(actor, "technotchad_clients", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.technoClient.findMany({
    include: { _count: { select: { subscriptions: true, contracts: true, licenses: true } } },
    orderBy: { legalName: "asc" },
  });
}

export async function createTechnoClient(
  actor: CurrentUser,
  input: {
    legalName: string;
    commercialName?: string;
    clientType: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    contactPerson?: string;
    taxNumber?: string;
  },
) {
  if (!can(actor, "technotchad_clients", "create")) throw new ApiError(403, "Permission insuffisante.");
  const legalName = input.legalName?.trim();
  const clientType = input.clientType?.trim();
  if (!legalName || !clientType) throw new ApiError(400, "Raison sociale et type de client sont requis.");
  const created = await prisma.technoClient.create({
    data: {
      clientCode: generateRecordNumber("TECH-CLI"),
      legalName,
      commercialName: input.commercialName?.trim() || null,
      clientType,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      taxNumber: input.taxNumber?.trim() || null,
    },
  });
  await logAudit({
    user: actor,
    action: "CREATE",
    module: "technotchad_clients",
    entityType: "TechnoClient",
    entityId: created.id,
    newValue: created,
  });
  return created;
}

export async function listTechnoProducts(actor: CurrentUser) {
  if (!can(actor, "technotchad_products", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.technoProduct.findMany({
    include: { modules: true, _count: { select: { subscriptions: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listTechnoPlans(actor: CurrentUser, productId?: string) {
  if (!can(actor, "technotchad_plans", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.technoSubscriptionPlan.findMany({
    where: productId ? { productId } : undefined,
    include: { product: true },
    orderBy: { name: "asc" },
  });
}

export async function listTechnoSubscriptions(actor: CurrentUser) {
  if (!can(actor, "technotchad_subscriptions", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.technoSubscription.findMany({
    include: { client: true, product: true, plan: true, licenses: true, sites: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTechnoSubscription(
  actor: CurrentUser,
  input: {
    clientId: string;
    productId: string;
    planId: string;
    startDate: string;
    endDate: string;
    amount: number;
    autoRenew?: boolean;
  },
) {
  if (!can(actor, "technotchad_subscriptions", "create")) throw new ApiError(403, "Permission insuffisante.");
  const { clientId, productId, planId } = input;
  if (!clientId || !productId || !planId) throw new ApiError(400, "Client, produit et plan sont requis.");
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new ApiError(400, "Periode d'abonnement invalide.");
  }
  const [client, product, plan] = await Promise.all([
    prisma.technoClient.findUnique({ where: { id: clientId } }),
    prisma.technoProduct.findUnique({ where: { id: productId }, include: { modules: true } }),
    prisma.technoSubscriptionPlan.findUnique({ where: { id: planId } }),
  ]);
  if (!client) throw new ApiError(404, "Client introuvable.");
  if (!product) throw new ApiError(404, "Produit introuvable.");
  if (!plan || plan.productId !== productId) throw new ApiError(404, "Plan introuvable pour ce produit.");

  const amount = Number.isFinite(input.amount) ? input.amount : plan.price;

  const subscription = await prisma.technoSubscription.create({
    data: {
      subscriptionNumber: generateRecordNumber("SUB"),
      clientId,
      productId,
      planId,
      startDate,
      endDate,
      amount,
      currency: plan.currency,
      status: "ACTIVE",
      autoRenew: input.autoRenew ?? plan.autoRenew,
    },
  });

  if (product.modules.length > 0) {
    await prisma.technoSubscriptionModule.createMany({
      data: product.modules.map((m) => ({ subscriptionId: subscription.id, moduleId: m.id, enabled: true })),
    });
  }

  const license = await prisma.technoLicense.create({
    data: {
      licenseKey: generateLicenseKey(product.productCode),
      subscriptionId: subscription.id,
      clientId,
      productId,
      licenseType: "STANDARD",
      activatedAt: startDate,
      expiresAt: endDate,
      maxUsers: plan.maxUsers,
      maxSites: plan.maxSites,
      status: "ACTIVE",
    },
  });

  await logAudit({
    user: actor,
    action: "CREATE",
    module: "technotchad_subscriptions",
    entityType: "TechnoSubscription",
    entityId: subscription.id,
    newValue: { subscription, license },
  });

  return { subscription, license };
}

export async function suspendTechnoSubscription(actor: CurrentUser, id: string) {
  if (!can(actor, "technotchad_subscriptions", "suspend")) throw new ApiError(403, "Permission insuffisante.");
  const existing = await prisma.technoSubscription.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Abonnement introuvable.");
  const updated = await prisma.technoSubscription.update({
    where: { id },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
  });
  await prisma.technoLicense.updateMany({
    where: { subscriptionId: id },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
  });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "technotchad_subscriptions",
    entityType: "TechnoSubscription",
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: updated.status },
  });
  return updated;
}

export async function listTechnoLicenses(actor: CurrentUser) {
  if (!can(actor, "technotchad_licenses", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.technoLicense.findMany({
    include: { client: true, product: true, subscription: true },
    orderBy: { issuedAt: "desc" },
  });
}

export async function getTechnoDashboardStats() {
  const [clientCount, activeSubscriptions, activeLicenses, expiringSoon] = await Promise.all([
    prisma.technoClient.count(),
    prisma.technoSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.technoLicense.count({ where: { status: "ACTIVE" } }),
    prisma.technoSubscription.count({
      where: { status: "ACTIVE", endDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);
  return { clientCount, activeSubscriptions, activeLicenses, expiringSoon };
}

export async function revokeTechnoLicense(actor: CurrentUser, id: string) {
  if (!can(actor, "technotchad_licenses", "revoke")) throw new ApiError(403, "Permission insuffisante.");
  const existing = await prisma.technoLicense.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Licence introuvable.");
  const updated = await prisma.technoLicense.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await logAudit({
    user: actor,
    action: "UPDATE",
    module: "technotchad_licenses",
    entityType: "TechnoLicense",
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: updated.status },
  });
  return updated;
}
