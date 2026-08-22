import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const PERIODICITIES = ["JOURNALIERE", "HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "AUTRE"];
const EMPLACEMENT_TYPES = ["BOUTIQUE", "MARCHE", "ETAL", "AUTRE"];

// Referentiel tarifaire (section 10). Ne renvoie que les tarifs actuellement
// applicables par defaut (statut ACTIF, non expires) ; `includeHistory` donne
// acces a toutes les versions passees pour la tracabilite.
export async function listTariffs(includeHistory = false) {
  return prisma.tarifMunicipal.findMany({
    where: includeHistory ? undefined : { status: "ACTIF" },
    include: { activity: true },
    orderBy: [{ emplacementType: "asc" }, { startDate: "desc" }],
  });
}

export type CreateTariffInput = {
  code: string;
  label: string;
  category?: string;
  activityId?: string | null;
  emplacementType: string;
  periodicity: string;
  amount: number;
  legalReference?: string;
};

// Un tarif n'est jamais modifie en place (section 10 : "Un tarif historique
// ne doit jamais etre ecrase. Creer une nouvelle version du tarif."). Si un
// tarif ACTIF porte deja ce code, il est cloture (endDate = maintenant,
// status = INACTIF) et remplace par une nouvelle ligne.
export async function createOrReviseTariff(actor: CurrentUser, input: CreateTariffInput) {
  if (!can(actor, "tariffs", "create")) throw new ApiError(403, "Permission insuffisante.");
  const code = input.code?.trim().toUpperCase();
  const label = input.label?.trim();
  if (!code || !label) throw new ApiError(400, "Code et libelle requis.");
  if (!EMPLACEMENT_TYPES.includes(input.emplacementType)) throw new ApiError(400, "Type d'emplacement invalide.");
  if (!PERIODICITIES.includes(input.periodicity)) throw new ApiError(400, "Periodicite invalide.");
  if (!input.amount || input.amount <= 0) throw new ApiError(400, "Montant invalide.");

  const previousVersion = await prisma.tarifMunicipal.findFirst({ where: { code, status: "ACTIF" } });

  const created = await prisma.$transaction(async (tx) => {
    if (previousVersion) {
      await tx.tarifMunicipal.update({
        where: { id: previousVersion.id },
        data: { status: "INACTIF", endDate: new Date() },
      });
    }
    return tx.tarifMunicipal.create({
      data: {
        code,
        label,
        category: input.category?.trim(),
        activityId: input.activityId || null,
        emplacementType: input.emplacementType,
        periodicity: input.periodicity,
        amount: input.amount,
        legalReference: input.legalReference?.trim(),
        createdById: actor.id,
      },
    });
  });

  await logAudit({
    user: actor,
    action: previousVersion ? "REVISE" : "CREATE",
    module: "tariffs",
    entityType: "TarifMunicipal",
    entityId: created.id,
    oldValue: previousVersion ? { amount: previousVersion.amount, version: previousVersion.id } : undefined,
    newValue: { code: created.code, amount: created.amount },
  });

  return created;
}
