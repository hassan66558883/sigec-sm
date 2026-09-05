import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { applyMapping, CITIZENS_REQUIRED_FIELDS } from "@/lib/services/integration-mapping";
import { createCitizen } from "@/lib/services/citizens";
import type { CurrentUser } from "@/lib/auth";

// Import/Export (section 14) — assistant en 2 actes reels : previewImport()
// analyse/mappe/valide et NE CREE RIEN ; commitImport() cree reellement les
// enregistrements, uniquement a partir des lignes deja marquees valides.
// "Ne jamais importer directement sans validation" (section 14) — il n'y a
// aucun chemin qui saute l'etape previewImport().

function requirePermission(actor: CurrentUser) {
  if (!can(actor, "integration", "import_export")) throw new ApiError(403, "Permission insuffisante.");
}

export type RowDiagnostic = { row: number; data: Record<string, string>; errors: string[]; warnings: string[] };

async function validateCitizenRow(mapped: Record<string, string>, seen: Set<string>): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of CITIZENS_REQUIRED_FIELDS) {
    if (!mapped[field]?.trim()) errors.push(`Champ obligatoire manquant : ${field}`);
  }
  if (mapped.sex && mapped.sex !== "M" && mapped.sex !== "F") errors.push("Sexe invalide (attendu M ou F)");
  if (mapped.dateOfBirth && Number.isNaN(Date.parse(mapped.dateOfBirth))) errors.push(`Date de naissance invalide : ${mapped.dateOfBirth}`);

  if (mapped.arrondissementCode) {
    const arr = await prisma.arrondissement.findUnique({ where: { code: mapped.arrondissementCode } });
    if (!arr) errors.push(`Code arrondissement inconnu : ${mapped.arrondissementCode}`);
  }

  // Doublon EXACT dans le fichier lui-meme (meme nom/prenom/date/arrondissement
  // repete) : rejete, contrairement a un homonyme deja present en base qui
  // reste un simple avertissement (un vrai homonyme existe, voir la meme
  // regle deja appliquee aux detecteurs de fraude etat-civil).
  const key = `${mapped.firstName?.toLowerCase()}|${mapped.lastName?.toLowerCase()}|${mapped.dateOfBirth}|${mapped.arrondissementCode}`;
  if (seen.has(key)) {
    errors.push("Doublon exact dans le fichier importe");
  } else {
    seen.add(key);
    if (mapped.firstName && mapped.lastName) {
      const existing = await prisma.citizen.findFirst({
        where: { firstName: { equals: mapped.firstName, mode: "insensitive" }, lastName: { equals: mapped.lastName, mode: "insensitive" } },
      });
      if (existing) warnings.push("Un homonyme existe deja en base (verifier avant import si ce n'est pas la meme personne)");
    }
  }

  return { errors, warnings };
}

export async function previewImport(actor: CurrentUser, input: { mappingId: string; csvContent: string; fileName: string }) {
  requirePermission(actor);
  const mapping = await prisma.integrationMapping.findUnique({ where: { id: input.mappingId }, include: { rules: { orderBy: { order: "asc" } } } });
  if (!mapping) throw new ApiError(404, "Mapping introuvable.");
  if (mapping.entityType !== "CITIZENS") throw new ApiError(400, "Type d'entite non pris en charge pour l'import.");

  const sourceRows = parseCsv(input.csvContent);
  if (sourceRows.length === 0) throw new ApiError(400, "Fichier vide ou illisible.");

  const seen = new Set<string>();
  const diagnostics: RowDiagnostic[] = [];
  for (let i = 0; i < sourceRows.length; i++) {
    const mapped = applyMapping(mapping.rules, sourceRows[i]);
    const { errors, warnings } = await validateCitizenRow(mapped, seen);
    diagnostics.push({ row: i + 2, data: mapped, errors, warnings }); // +2 : ligne 1 = en-tetes
  }

  const validRows = diagnostics.filter((d) => d.errors.length === 0).length;
  const invalidRows = diagnostics.length - validRows;

  const job = await prisma.integrationImportJob.create({
    data: {
      mappingId: mapping.id,
      entityType: mapping.entityType,
      fileName: input.fileName,
      totalRows: diagnostics.length,
      validRows,
      invalidRows,
      validatedRows: JSON.stringify(diagnostics),
      createdById: actor.id,
    },
  });

  await logAudit({ user: actor, action: "IMPORT_PREVIEWED", module: "integration", entityType: "IntegrationImportJob", entityId: job.id, newValue: { fileName: input.fileName, totalRows: diagnostics.length, validRows, invalidRows } });

  // Apercu limite (section 14, etape 6) — les 20 premieres lignes suffisent
  // a l'administrateur pour verifier le mapping avant de confirmer.
  return { jobId: job.id, totalRows: diagnostics.length, validRows, invalidRows, preview: diagnostics.slice(0, 20) };
}

export async function listImportJobs(actor: CurrentUser) {
  requirePermission(actor);
  return prisma.integrationImportJob.findMany({ orderBy: { createdAt: "desc" }, include: { mapping: { select: { name: true } } } });
}

export async function getImportJob(actor: CurrentUser, id: string) {
  requirePermission(actor);
  const job = await prisma.integrationImportJob.findUnique({ where: { id } });
  if (!job) throw new ApiError(404, "Import introuvable.");
  return job;
}

// Cree reellement les citoyens des lignes marquees valides lors de
// previewImport() — reutilise createCitizen() telle quelle (memes
// validations/audit/evenement citizen.created qu'une creation manuelle),
// jamais une ecriture Prisma directe qui contournerait ces garanties.
export async function commitImport(actor: CurrentUser, jobId: string) {
  requirePermission(actor);
  const job = await prisma.integrationImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ApiError(404, "Import introuvable.");
  if (job.status !== "PREVIEWED") throw new ApiError(400, "Cet import a deja ete traite.");
  if (!job.validatedRows) throw new ApiError(400, "Aucune ligne validee pour cet import.");

  const diagnostics = JSON.parse(job.validatedRows) as RowDiagnostic[];
  const validDiagnostics = diagnostics.filter((d) => d.errors.length === 0);

  const writeErrors: { row: number; message: string }[] = [];
  let importedCount = 0;

  for (const diag of validDiagnostics) {
    const arr = await prisma.arrondissement.findUnique({ where: { code: diag.data.arrondissementCode } });
    if (!arr) {
      writeErrors.push({ row: diag.row, message: `Code arrondissement introuvable au moment de l'import : ${diag.data.arrondissementCode}` });
      continue;
    }
    try {
      await createCitizen(actor, {
        firstName: diag.data.firstName,
        lastName: diag.data.lastName,
        sex: diag.data.sex,
        dateOfBirth: diag.data.dateOfBirth || undefined,
        nationality: diag.data.nationality || undefined,
        phone: diag.data.phone || undefined,
        address: diag.data.address || undefined,
        arrondissementId: arr.id,
      });
      importedCount++;
    } catch (error) {
      writeErrors.push({ row: diag.row, message: error instanceof Error ? error.message : "Erreur inconnue." });
    }
  }

  const updated = await prisma.integrationImportJob.update({
    where: { id: jobId },
    data: {
      status: writeErrors.length === 0 ? "IMPORTED" : importedCount > 0 ? "IMPORTED" : "FAILED",
      importedRows: importedCount,
      errors: writeErrors.length > 0 ? JSON.stringify(writeErrors) : null,
      importedAt: new Date(),
    },
  });

  await logAudit({ user: actor, action: "IMPORT_COMMITTED", module: "integration", entityType: "IntegrationImportJob", entityId: jobId, newValue: { importedCount, writeErrorCount: writeErrors.length } });

  return updated;
}
