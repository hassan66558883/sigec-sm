import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendSms } from "@/lib/services/sms";
import { decryptField } from "@/lib/encryption";

// Echeancier de relance (module paiement en ligne, section 19) — fixe par
// la note officielle du Maire, jamais invente ici :
//   J-7 : rappel avant echeance
//   J-1 : rappel avant echeance
//   J+1 : facture echue (passe EN_RETARD)
//   J+7 : relance
// offsetDays = decalage (jours) entre aujourd'hui et l'echeance ciblee :
// positif = echeance a venir (dueDate = aujourd'hui + offsetDays), negatif =
// echeance passee (dueDate = aujourd'hui - |offsetDays|).
const REMINDER_SCHEDULE: { type: string; offsetDays: number }[] = [
  { type: "J-7", offsetDays: 7 },
  { type: "J-1", offsetDays: 1 },
  { type: "J+1", offsetDays: -1 },
  { type: "J+7", offsetDays: -7 },
];

const UNPAID_STATUSES = ["A_PAYER", "PARTIELLEMENT_PAYE", "EN_RETARD"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const REMINDER_MESSAGE: Record<string, (numero: string, echeance: string) => string> = {
  "J-7": (numero, echeance) => `Rappel : votre facture ${numero} arrive a echeance le ${echeance}. Pensez a regler votre solde.`,
  "J-1": (numero, echeance) => `Rappel : votre facture ${numero} arrive a echeance demain (${echeance}).`,
  "J+1": (numero, echeance) => `Votre facture ${numero} est echue depuis le ${echeance}. Merci de regulariser votre situation.`,
  "J+7": (numero, echeance) => `Relance : votre facture ${numero}, echue depuis le ${echeance}, reste impayee. Merci de regulariser rapidement.`,
};

// Point d'entree unique (appele par /api/cron/relances, voir docs/DEPLOYMENT.md
// pour la configuration cron). Idempotent : ObligationReminder porte une
// contrainte d'unicite (obligationId, type) — une meme relance n'est jamais
// envoyee deux fois, meme si la tache est declenchee plusieurs fois le
// meme jour. Non bloquant : une erreur sur une obligation ne doit jamais
// interrompre le traitement des autres.
export async function runDueReminders(now: Date = new Date()) {
  const results: { type: string; obligationId: string; notified: boolean; smsSent: boolean }[] = [];

  for (const { type, offsetDays } of REMINDER_SCHEDULE) {
    const targetDayStart = startOfDay(new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000));
    const targetDayEnd = new Date(targetDayStart.getTime() + 24 * 60 * 60 * 1000);

    const obligations = await prisma.obligationPaiement.findMany({
      where: {
        dueDate: { gte: targetDayStart, lt: targetDayEnd },
        status: { in: UNPAID_STATUSES },
      },
      include: { citizen: { include: { citizenAccount: true } } },
    });

    for (const obligation of obligations) {
      // Idempotence : si cette relance a deja ete envoyee pour cette
      // obligation, on ne rejoue rien (skip silencieux, pas une erreur).
      const already = await prisma.obligationReminder.findUnique({
        where: { obligationId_type: { obligationId: obligation.id, type } },
      });
      if (already) continue;

      // J+1/J+7 (echeance passee) : la facture echue passe EN_RETARD si elle
      // ne l'est pas deja.
      if (offsetDays < 0 && obligation.status !== "EN_RETARD") {
        await prisma.obligationPaiement.update({ where: { id: obligation.id }, data: { status: "EN_RETARD" } });
      }

      const echeance = obligation.dueDate.toLocaleDateString("fr-FR");
      const message = REMINDER_MESSAGE[type](obligation.number, echeance);

      let notified = false;
      if (obligation.citizen.citizenAccount) {
        await prisma.notification.create({
          data: {
            citizenAccountId: obligation.citizen.citizenAccount.id,
            title: type.startsWith("J-") ? "Rappel d'echeance" : "Facture impayee",
            message,
          },
        });
        notified = true;
      }

      let smsSent = false;
      const citizenPhone = decryptField(obligation.citizen.phone);
      if (citizenPhone) {
        const result = await sendSms(citizenPhone, message);
        smsSent = result.sent;
      }

      await prisma.obligationReminder.create({
        data: { obligationId: obligation.id, type, notified, smsSent },
      });

      results.push({ type, obligationId: obligation.id, notified, smsSent });
    }
  }

  if (results.length > 0) {
    await logAudit({
      user: null,
      action: "REMINDER",
      module: "obligations",
      entityType: "ObligationReminder",
      newValue: { count: results.length, byType: results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }), {}) },
    });
  }

  return results;
}
