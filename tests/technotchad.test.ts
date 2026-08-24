import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  listTechnoClients,
  createTechnoClient,
  createTechnoSubscription,
  suspendTechnoSubscription,
  listTechnoLicenses,
  revokeTechnoLicense,
} from "../src/lib/services/technotchad";
import { createTestUser, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

const TECHNO_PERMISSIONS = [
  "technotchad_clients:view", "technotchad_clients:create",
  "technotchad_products:view",
  "technotchad_plans:view",
  "technotchad_subscriptions:view", "technotchad_subscriptions:create", "technotchad_subscriptions:suspend",
  "technotchad_licenses:view", "technotchad_licenses:revoke",
];

// Section 23/38 du cahier des charges TECHNOTCHAD : le sous-systeme commercial
// (clients/produits/abonnements/licences de l'editeur) doit rester
// strictement isole des donnees metier municipales SIGEC-SM, via des
// permissions dediees "technotchad_*" jamais accordees au SUPER_ADMIN
// municipal (voir l'exclusion explicite dans prisma/seed.ts).
describe("TECHNOTCHAD — abonnements et licences (editeur)", () => {
  let productId: string;
  let productCode: string;
  let planId: string;

  beforeAll(async () => {
    productCode = uid("PRD");
    const product = await testPrisma.technoProduct.create({
      data: { productCode, name: uid("Produit Test") },
    });
    productId = product.id;
    const plan = await testPrisma.technoSubscriptionPlan.create({
      data: {
        productId,
        planCode: uid("PLAN"),
        name: uid("Plan Test"),
        billingPeriod: "ANNUAL",
        price: 100000,
        currency: "XAF",
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("createTechnoClient refuse sans permission, cree avec permission", async () => {
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });
    await expect(
      createTechnoClient(noPerm, { legalName: "Client sans permission", clientType: "ENTREPRISE" }),
    ).rejects.toMatchObject({ status: 403 });

    const actor = await createTestUser({ organizationLevel: "CENTRAL", permissions: TECHNO_PERMISSIONS });
    const client = await createTechnoClient(actor, { legalName: "Client Test SARL", clientType: "ENTREPRISE" });
    expect(client.clientCode).toMatch(/^TECH-CLI-\d{4}-[0-9A-F]{8}$/);
    expect(client.status).toBe("ACTIVE");

    const list = await listTechnoClients(actor);
    expect(list.some((c) => c.id === client.id)).toBe(true);
  });

  it("createTechnoSubscription genere une licence, les modules et rejette une periode invalide", async () => {
    const actor = await createTestUser({ organizationLevel: "CENTRAL", permissions: TECHNO_PERMISSIONS });
    const client = await createTechnoClient(actor, { legalName: uid("Client Abonne"), clientType: "MAIRIE" });

    await expect(
      createTechnoSubscription(actor, {
        clientId: client.id,
        productId,
        planId,
        startDate: "2026-06-01",
        endDate: "2026-01-01", // fin avant debut
        amount: 100000,
      }),
    ).rejects.toMatchObject({ status: 400 });

    const { subscription, license } = await createTechnoSubscription(actor, {
      clientId: client.id,
      productId,
      planId,
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      amount: 100000,
    });

    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.subscriptionNumber).toMatch(/^SUB-\d{4}-[0-9A-F]{8}$/);
    expect(license.status).toBe("ACTIVE");
    expect(license.licenseKey.startsWith(`${productCode}-`)).toBe(true);
    expect(license.subscriptionId).toBe(subscription.id);
  });

  it("suspendTechnoSubscription suspend l'abonnement ET sa licence", async () => {
    const actor = await createTestUser({ organizationLevel: "CENTRAL", permissions: TECHNO_PERMISSIONS });
    const client = await createTechnoClient(actor, { legalName: uid("Client Suspendu"), clientType: "MAIRIE" });
    const { subscription, license } = await createTechnoSubscription(actor, {
      clientId: client.id,
      productId,
      planId,
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      amount: 100000,
    });

    const suspended = await suspendTechnoSubscription(actor, subscription.id);
    expect(suspended.status).toBe("SUSPENDED");
    expect(suspended.suspendedAt).not.toBeNull();

    const updatedLicense = await testPrisma.technoLicense.findUniqueOrThrow({ where: { id: license.id } });
    expect(updatedLicense.status).toBe("SUSPENDED");
  });

  it("revokeTechnoLicense refuse sans permission, revoque avec permission", async () => {
    const actor = await createTestUser({ organizationLevel: "CENTRAL", permissions: TECHNO_PERMISSIONS });
    const client = await createTechnoClient(actor, { legalName: uid("Client Licence"), clientType: "MAIRIE" });
    const { license } = await createTechnoSubscription(actor, {
      clientId: client.id,
      productId,
      planId,
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      amount: 100000,
    });

    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["technotchad_licenses:view"] });
    await expect(revokeTechnoLicense(noPerm, license.id)).rejects.toMatchObject({ status: 403 });

    const revoked = await revokeTechnoLicense(actor, license.id);
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revokedAt).not.toBeNull();

    const list = await listTechnoLicenses(actor);
    expect(list.find((l) => l.id === license.id)?.status).toBe("REVOKED");
  });

  // Regle 23 du cahier des charges : verifie directement l'etat REEL de la
  // base seedee (pas seulement le code de can()) — la garantie doit tenir au
  // niveau des donnees, pas seulement du code applicatif.
  it("le role municipal SUPER_ADMIN n'a AUCUNE permission technotchad_* (exclusion du wildcard ALL)", async () => {
    const superAdmin = await testPrisma.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
      include: { permissions: { include: { permission: true } } },
    });
    const leaked = superAdmin.permissions.filter((p) => p.permission.code.startsWith("technotchad_"));
    expect(leaked).toEqual([]);
    expect(superAdmin.permissions.length).toBeGreaterThan(0);
  });

  it("le role TECHNOTCHAD_SUPER_ADMIN n'a AUCUNE permission municipale", async () => {
    const technoAdmin = await testPrisma.role.findUniqueOrThrow({
      where: { code: "TECHNOTCHAD_SUPER_ADMIN" },
      include: { permissions: { include: { permission: true } } },
    });
    const leaked = technoAdmin.permissions.filter((p) => !p.permission.code.startsWith("technotchad_"));
    expect(leaked).toEqual([]);
    expect(technoAdmin.permissions.length).toBeGreaterThan(0);
  });
});
