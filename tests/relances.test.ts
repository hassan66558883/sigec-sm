import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runDueReminders } from "../src/lib/services/relances";
import { createTestCity, createTestArrondissement, createTestCitizen, createTestCitizenAccount, uid, testPrisma, closeTestDb } from "./helpers/fixtures";

// Echeancier de relance (module paiement en ligne, section 19) : J-7, J-1,
// J+1, J+7 — jours fixes par la note officielle, jamais inventes. Verifie
// la detection par jour calendaire, l'idempotence (ObligationReminder
// unique sur obligationId+type), et le passage automatique a EN_RETARD.
describe("relances — echeancier J-7/J-1/J+1/J+7", () => {
  let arrA: string;
  let tarifId: string;

  beforeAll(async () => {
    const city = await createTestCity();
    arrA = (await createTestArrondissement(city.id, 1)).id;
    const tarif = await testPrisma.tarifMunicipal.create({
      data: { code: uid("TARIF"), label: "Taxe test", emplacementType: "BOUTIQUE", periodicity: "MENSUELLE", amount: 5000 },
    });
    tarifId = tarif.id;
  });

  afterAll(async () => {
    await closeTestDb();
  });

  function daysFromNow(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  async function makeObligation(dueDate: Date, opts: { withAccount?: boolean; withPhone?: boolean } = {}) {
    const citizen = await createTestCitizen(arrA, {});
    if (opts.withPhone) {
      await testPrisma.citizen.update({ where: { id: citizen.id }, data: { phone: "+23566123456" } });
    }
    if (opts.withAccount) {
      await createTestCitizenAccount(citizen.id);
    }
    const obligation = await testPrisma.obligationPaiement.create({
      data: {
        number: uid("OBL"),
        citizenId: citizen.id,
        tarifId,
        period: "2026-08",
        initialAmount: 5000,
        dueDate,
        arrondissementId: arrA,
      },
    });
    return { citizen, obligation };
  }

  it("J-7 : envoie un rappel avant echeance, cree une Notification in-app pour un contribuable avec compte portail", async () => {
    const { obligation } = await makeObligation(daysFromNow(7), { withAccount: true, withPhone: true });

    const results = await runDueReminders();
    const mine = results.find((r) => r.obligationId === obligation.id);
    expect(mine).toBeDefined();
    expect(mine?.type).toBe("J-7");
    expect(mine?.notified).toBe(true);

    const reminder = await testPrisma.obligationReminder.findUnique({ where: { obligationId_type: { obligationId: obligation.id, type: "J-7" } } });
    expect(reminder).not.toBeNull();

    const notification = await testPrisma.notification.findFirst({ where: { message: { contains: obligation.number } } });
    expect(notification).not.toBeNull();
    expect(notification?.title).toBe("Rappel d'echeance");
  });

  it("est idempotent : executer runDueReminders() deux fois le meme jour n'envoie jamais deux fois la meme relance", async () => {
    const { obligation } = await makeObligation(daysFromNow(-1), { withAccount: true });

    const first = await runDueReminders();
    const firstMatch = first.filter((r) => r.obligationId === obligation.id);
    expect(firstMatch).toHaveLength(1);

    const second = await runDueReminders();
    const secondMatch = second.filter((r) => r.obligationId === obligation.id);
    expect(secondMatch).toHaveLength(0);

    const notifications = await testPrisma.notification.findMany({ where: { message: { contains: obligation.number } } });
    expect(notifications).toHaveLength(1);
  });

  it("J+1 : une facture echue depuis hier passe automatiquement EN_RETARD", async () => {
    const { obligation } = await makeObligation(daysFromNow(-1), { withAccount: true });
    expect(obligation.status).toBe("A_PAYER");

    await runDueReminders();

    const updated = await testPrisma.obligationPaiement.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(updated.status).toBe("EN_RETARD");
  });

  it("J+7 : une facture toujours impayee 7 jours apres l'echeance recoit une relance", async () => {
    const { obligation } = await makeObligation(daysFromNow(-7), { withAccount: true, withPhone: true });

    const results = await runDueReminders();
    const mine = results.find((r) => r.obligationId === obligation.id && r.type === "J+7");
    expect(mine).toBeDefined();
  });

  it("une obligation deja PAYE n'est jamais relancee", async () => {
    const { obligation } = await makeObligation(daysFromNow(-1));
    await testPrisma.obligationPaiement.update({ where: { id: obligation.id }, data: { status: "PAYE" } });

    const results = await runDueReminders();
    expect(results.some((r) => r.obligationId === obligation.id)).toBe(false);
  });

  it("une echeance qui ne correspond a aucun jour de l'echeancier (ex J+3) ne declenche aucune relance", async () => {
    const { obligation } = await makeObligation(daysFromNow(-3));
    const results = await runDueReminders();
    expect(results.some((r) => r.obligationId === obligation.id)).toBe(false);
  });

  it("un contribuable sans compte portail ni telephone recoit quand meme une trace de relance, notified=false", async () => {
    const { obligation } = await makeObligation(daysFromNow(-1));
    const results = await runDueReminders();
    const mine = results.find((r) => r.obligationId === obligation.id);
    expect(mine?.notified).toBe(false);
    expect(mine?.smsSent).toBe(false);

    const reminder = await testPrisma.obligationReminder.findUniqueOrThrow({ where: { obligationId_type: { obligationId: obligation.id, type: "J+1" } } });
    expect(reminder.notified).toBe(false);
  });
});
