import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth";

// Data Mapping Engine (section 11) — un seul type d'entite pour l'instant :
// CITIZENS. Etendre cette liste de champs cibles (et le service d'import
// correspondant) plutot que d'ajouter un entityType sans traitement reel
// derriere (section 43 : jamais d'ecran sans backend).
export const ENTITY_TYPES = ["CITIZENS"] as const;

export const CITIZENS_TARGET_FIELDS = [
  "firstName", "lastName", "sex", "dateOfBirth", "nationality", "phone", "address", "arrondissementCode",
] as const;
export const CITIZENS_REQUIRED_FIELDS = ["firstName", "lastName", "sex", "arrondissementCode"] as const;

export const TRANSFORMS = ["DIRECT", "DEFAULT_VALUE", "UPPERCASE", "LOWERCASE", "DATE_FORMAT"] as const;

function requirePermission(actor: CurrentUser) {
  if (!can(actor, "integration", "mapping_manage")) throw new ApiError(403, "Permission insuffisante.");
}

export async function listMappings(actor: CurrentUser) {
  requirePermission(actor);
  return prisma.integrationMapping.findMany({ orderBy: { createdAt: "desc" }, include: { rules: { orderBy: { order: "asc" } } } });
}

export async function getMapping(actor: CurrentUser, id: string) {
  requirePermission(actor);
  const mapping = await prisma.integrationMapping.findUnique({ where: { id }, include: { rules: { orderBy: { order: "asc" } } } });
  if (!mapping) throw new ApiError(404, "Mapping introuvable.");
  return mapping;
}

export type MappingRuleInput = { sourceField: string; targetField: string; transform: string; transformConfig?: Record<string, unknown> | null };
export type CreateMappingInput = { name: string; entityType: string; rules: MappingRuleInput[] };

function targetFieldsFor(entityType: string): readonly string[] {
  if (entityType === "CITIZENS") return CITIZENS_TARGET_FIELDS;
  return [];
}

export async function createMapping(actor: CurrentUser, input: CreateMappingInput) {
  requirePermission(actor);
  if (!ENTITY_TYPES.includes(input.entityType as (typeof ENTITY_TYPES)[number])) throw new ApiError(400, "Type d'entite invalide.");
  if (!input.name?.trim()) throw new ApiError(400, "Nom requis.");
  if (input.rules.length === 0) throw new ApiError(400, "Au moins une regle de mapping est requise.");

  const validTargets = targetFieldsFor(input.entityType);
  for (const rule of input.rules) {
    if (!rule.sourceField?.trim()) throw new ApiError(400, "Colonne source requise pour chaque regle.");
    if (!validTargets.includes(rule.targetField)) throw new ApiError(400, `Champ cible invalide : ${rule.targetField}`);
    if (!TRANSFORMS.includes(rule.transform as (typeof TRANSFORMS)[number])) throw new ApiError(400, `Transformation invalide : ${rule.transform}`);
  }

  const mapping = await prisma.integrationMapping.create({
    data: {
      name: input.name.trim(),
      entityType: input.entityType,
      createdById: actor.id,
      rules: {
        create: input.rules.map((r, i) => ({
          sourceField: r.sourceField.trim(),
          targetField: r.targetField,
          transform: r.transform,
          transformConfig: r.transformConfig ? JSON.stringify(r.transformConfig) : null,
          order: i,
        })),
      },
    },
    include: { rules: true },
  });

  await logAudit({ user: actor, action: "MAPPING_CREATED", module: "integration", entityType: "IntegrationMapping", entityId: mapping.id, newValue: { name: mapping.name, entityType: mapping.entityType, ruleCount: input.rules.length } });
  return mapping;
}

export async function deleteMapping(actor: CurrentUser, id: string) {
  requirePermission(actor);
  const mapping = await prisma.integrationMapping.findUnique({ where: { id } });
  if (!mapping) throw new ApiError(404, "Mapping introuvable.");
  await prisma.integrationMapping.delete({ where: { id } });
  await logAudit({ user: actor, action: "MAPPING_DELETED", module: "integration", entityType: "IntegrationMapping", entityId: id, oldValue: { name: mapping.name } });
}

type Rule = { sourceField: string; targetField: string; transform: string; transformConfig: string | null };

// Applique une regle de mapping a une valeur source (section 11 : mapping
// direct/transformation/valeur par defaut/conversion de date/texte).
// N'accede jamais a la base — fonction pure, testable independamment de
// tout fichier reel.
export function applyTransform(rawValue: string | undefined, rule: Rule): string {
  const config = rule.transformConfig ? (JSON.parse(rule.transformConfig) as Record<string, unknown>) : {};
  const value = (rawValue ?? "").trim();

  switch (rule.transform) {
    case "DEFAULT_VALUE":
      return value || String(config.defaultValue ?? "");
    case "UPPERCASE":
      return value.toUpperCase();
    case "LOWERCASE":
      return value.toLowerCase();
    case "DATE_FORMAT": {
      if (!value) return "";
      // Convertit un format source explicite (ex: "DD/MM/YYYY") vers
      // ISO (YYYY-MM-DD) — le seul format que createCitizen sait
      // interpreter. Sans format reconnu, la valeur brute est renvoyee
      // telle quelle et sera rejetee par la validation si elle n'est pas
      // deja ISO (jamais une conversion silencieuse incorrecte).
      const format = String(config.format ?? "");
      if (format === "DD/MM/YYYY") {
        const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      }
      return value;
    }
    case "DIRECT":
    default:
      return value;
  }
}

// Applique l'ensemble des regles d'un mapping a une ligne source (deja
// analysee par lib/csv.ts:parseCsv) — renvoie l'objet cible partiel,
// jamais valide ici (voir integration-import.ts pour la validation).
export function applyMapping(rules: Rule[], sourceRow: Record<string, string>): Record<string, string> {
  const target: Record<string, string> = {};
  for (const rule of rules) {
    target[rule.targetField] = applyTransform(sourceRow[rule.sourceField], rule);
  }
  return target;
}
