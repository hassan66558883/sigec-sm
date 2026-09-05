import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { recordPayment } from "../src/lib/services/payments";
import { confirmMobileMoneyPayment } from "../src/lib/services/mobile-money";
import { registerProvider, type PaymentProvider } from "../src/lib/services/payment-provider";
import {
  ingestReconciliationStatement,
  listReconciliationBatches,
  getReconciliationBatch,
  resolveReconciliationEntry,
} from "../src/lib/services/reconciliation";
import { createTestCity, createTestArrondissement, createTestUser, createTestCitizen, testPrisma, uid, closeTestDb } from "./helpers/fixtures";

// Rapprochement prestataire/banque (module paiement QR, section 31) —
// distinct de caisses/versements (especes physique uniquement). Verifie les
// 4 classifications (reconcilie, ecart de montant, absent du releve, absent
// en interne) contre de VRAIES MobileMoneyTransaction confirmees via le
// meme chemin que la production (recordPayment + confirmMobileMoneyPayment),
// jamais des lignes fabriquees directement en base.
//
// recordPayment()/initiateMobileMoneyPayment() ecrivent toujours
// provider="MANUAL" (valeur par defaut du schema, aucun param pour la
// choisir) — comme tous les autres tests Mobile Money de la suite (y
// compris les autres "it" de CE fichier, qui partagent la meme fenetre
// "maintenant ± 1h") partagent la meme base, un filtrage provider+periode
// capterait leurs transactions si on reutilisait un provider commun. On
// enregistre donc un prestataire de test DEDIE A CHAQUE TEST (extension
// point officiel, registerProvider()) et on ne fait que RELABELISER le
// champ `provider` des transactions creees (elles restent de vraies
// transactions, creees/confirmees par le vrai flux) — jamais de ligne
// fabriquee directement en base.
function registerTestProvider(): string {
  const code = uid("TEST_RECON");
  const provider: PaymentProvider = {
    code,
    async initializePayment() {
      return { providerTransactionId: null, redirectUrl: null };
    },
    async checkPaymentStatus() {
      return { status: "PENDING" as const };
    },
    async verifyTransaction() {
      return false;
    },
    async handleCallback() {
      return null;
    },
    async refundPayment() {
      return { providerReference: null };
    },
  };
  registerProvider(provider);
  return code;
}

describe("rapprochement prestataire/banque", () => {
  let arrA: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function makeConfirmedTransaction(admin: Awaited<ReturnType<typeof createTestUser>>, owner: Awaited<ReturnType<typeof createTestCitizen>>, amount: number, provider: string) {
    const ref = uid("MMREF");
    const initiated = await recordPayment(admin, { payerId: owner.id, amount, paymentMethod: "MOBILE_MONEY", phoneNumber: "+23566000010", externalReference: ref });
    const transaction = await testPrisma.mobileMoneyTransaction.findUniqueOrThrow({ where: { paymentId: initiated.id } });
    await confirmMobileMoneyPayment(admin, transaction.id);
    await testPrisma.mobileMoneyTransaction.update({ where: { id: transaction.id }, data: { provider } });
    return ref;
  }

  it("classe correctement les 4 cas : reconcilie, ecart de montant, absent du releve, absent en interne", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create", "mobile_money:confirm", "reconciliation:view", "reconciliation:create"] });
    const owner = await createTestCitizen(arrA);

    const provider = registerTestProvider();
    const matchedRef = await makeConfirmedTransaction(admin, owner, 5000, provider);
    const mismatchRef = await makeConfirmedTransaction(admin, owner, 3000, provider);
    const missingRef = await makeConfirmedTransaction(admin, owner, 2000, provider);
    const unmatchedRef = uid("MMREF"); // n'existe jamais en interne

    const periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 10);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

    const csvText = [
      "reference,montant,date",
      `${matchedRef},5000,2026-09-05`,
      `${mismatchRef},2500,2026-09-05`, // different de 3000 en interne
      `${unmatchedRef},1000,2026-09-05`,
    ].join("\n");

    const batch = await ingestReconciliationStatement(admin, { provider, periodStart, periodEnd, fileName: "releve-test.csv", csvText });

    expect(batch.matchedCount).toBe(1);
    expect(batch.mismatchCount).toBe(1);
    expect(batch.missingInternalCount).toBe(1); // missingRef n'apparait pas dans le CSV
    expect(batch.unmatchedExternalCount).toBe(1);

    const detail = await getReconciliationBatch(admin, batch.id);
    const byRef = new Map(detail.entries.map((e) => [e.externalReference, e]));
    expect(byRef.get(matchedRef)?.status).toBe("MATCHED");
    expect(byRef.get(mismatchRef)?.status).toBe("AMOUNT_MISMATCH");
    expect(byRef.get(missingRef)?.status).toBe("MISSING_INTERNAL");
    expect(byRef.get(unmatchedRef)?.status).toBe("UNMATCHED_EXTERNAL");

    const alert = await testPrisma.fraudAlert.findFirst({ where: { type: "RECONCILIATION_DISCREPANCY" }, orderBy: { createdAt: "desc" } });
    expect(alert).not.toBeNull();
    expect(alert?.description).toContain("3 ecart(s)");

    const listed = await listReconciliationBatches(admin);
    expect(listed.map((b) => b.id)).toContain(batch.id);
  });

  it("ne journalise aucune alerte quand le releve est entierement reconcilie", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create", "mobile_money:confirm", "reconciliation:create"] });
    const owner = await createTestCitizen(arrA);
    const provider = registerTestProvider();
    const ref = await makeConfirmedTransaction(admin, owner, 1500, provider);

    const periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 10);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    const csvText = `reference,montant\n${ref},1500\n`;

    const before = await testPrisma.fraudAlert.count({ where: { type: "RECONCILIATION_DISCREPANCY" } });
    const batch = await ingestReconciliationStatement(admin, { provider, periodStart, periodEnd, fileName: "releve-propre.csv", csvText });
    expect(batch.matchedCount).toBe(1);
    expect(batch.mismatchCount + batch.missingInternalCount + batch.unmatchedExternalCount).toBe(0);
    const after = await testPrisma.fraudAlert.count({ where: { type: "RECONCILIATION_DISCREPANCY" } });
    expect(after).toBe(before);
  });

  it("refuse un prestataire inconnu, une periode invalide, un CSV vide, et applique les permissions", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["reconciliation:create"] });
    const noPerm = await createTestUser({ organizationLevel: "CENTRAL", permissions: [] });

    await expect(
      ingestReconciliationStatement(noPerm, { provider: "MANUAL", periodStart: "2026-01-01", periodEnd: "2026-01-31", fileName: "x.csv", csvText: "reference,montant\nA,1\n" }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      ingestReconciliationStatement(admin, { provider: "INCONNU", periodStart: "2026-01-01", periodEnd: "2026-01-31", fileName: "x.csv", csvText: "reference,montant\nA,1\n" }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      ingestReconciliationStatement(admin, { provider: "MANUAL", periodStart: "2026-01-31", periodEnd: "2026-01-01", fileName: "x.csv", csvText: "reference,montant\nA,1\n" }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      ingestReconciliationStatement(admin, { provider: "MANUAL", periodStart: "2026-01-01", periodEnd: "2026-01-31", fileName: "x.csv", csvText: "reference,montant\n" }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(listReconciliationBatches(noPerm)).rejects.toMatchObject({ status: 403 });
  });

  it("resoudre une ligne exige une note, refuse une ligne reconciliee ou deja resolue", async () => {
    const admin = await createTestUser({ organizationLevel: "CENTRAL", permissions: ["payments:create", "mobile_money:confirm", "reconciliation:view", "reconciliation:create", "reconciliation:resolve"] });
    const owner = await createTestCitizen(arrA);
    const provider = registerTestProvider();
    const matchedRef = await makeConfirmedTransaction(admin, owner, 4000, provider);
    const unmatchedRef = uid("MMREF");

    const periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 10);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    const csvText = [`reference,montant`, `${matchedRef},4000`, `${unmatchedRef},999`].join("\n");
    const batch = await ingestReconciliationStatement(admin, { provider, periodStart, periodEnd, fileName: "r.csv", csvText });
    const detail = await getReconciliationBatch(admin, batch.id);
    const matchedEntry = detail.entries.find((e) => e.status === "MATCHED")!;
    const unmatchedEntry = detail.entries.find((e) => e.status === "UNMATCHED_EXTERNAL")!;

    await expect(resolveReconciliationEntry(admin, matchedEntry.id, "note")).rejects.toMatchObject({ status: 400 });
    await expect(resolveReconciliationEntry(admin, unmatchedEntry.id, "")).rejects.toMatchObject({ status: 400 });

    const resolved = await resolveReconciliationEntry(admin, unmatchedEntry.id, "Verifie aupres du prestataire, ligne test.");
    expect(resolved.resolved).toBe(true);

    await expect(resolveReconciliationEntry(admin, unmatchedEntry.id, "encore")).rejects.toMatchObject({ status: 400 });
  });
});
