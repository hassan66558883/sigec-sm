import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";

const CATEGORIES = ["VOIRIE", "PROPRETE", "ECLAIRAGE", "EAU", "SECURITE", "AUTRE"];
const STATUSES = ["NEW", "RECEIVED", "ASSIGNED", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"];

type CitizenAccountWithCitizen = { id: string; citizen: { arrondissementId: string } };

// --- Cote citoyen (guichet numerique, section 13) --------------------------

export async function listMyComplaints(account: CitizenAccountWithCitizen) {
  return prisma.complaint.findMany({
    where: { citizenAccountId: account.id },
    include: { updates: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function submitComplaint(
  account: CitizenAccountWithCitizen,
  input: { category: string; description: string },
) {
  if (!CATEGORIES.includes(input.category)) throw new ApiError(400, "Categorie invalide.");
  if (!input.description?.trim()) throw new ApiError(400, "Description requise.");

  const created = await prisma.complaint.create({
    data: {
      caseNumber: generateRecordNumber("PLT"),
      citizenAccountId: account.id,
      category: input.category,
      description: input.description.trim(),
      arrondissementId: account.citizen.arrondissementId,
      updates: { create: { status: "NEW", note: "Plainte deposee par le citoyen.", createdById: account.id } },
    },
    include: { updates: true },
  });
  return created;
}

// --- Cote agents -------------------------------------------------------------

export async function listComplaintsForStaff(user: CurrentUser) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.complaint.findMany({
    where: recordScopeWhere(user),
    include: { citizenAccount: { include: { citizen: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getComplaintForStaff(user: CurrentUser, id: string) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { citizenAccount: { include: { citizen: true } }, updates: { orderBy: { createdAt: "asc" } } },
  });
  if (!complaint) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(user, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");
  return complaint;
}

// Avance le dossier dans le workflow (section 13) et journalise chaque etape
// pour le suivi citoyen.
export async function updateComplaintStatus(actor: CurrentUser, id: string, status: string, note?: string) {
  if (!can(actor, "complaints", "update")) throw new ApiError(403, "Permission insuffisante.");
  if (!STATUSES.includes(status)) throw new ApiError(400, "Statut invalide.");
  const before = await prisma.complaint.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.complaint.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : before.resolvedAt,
        resolutionNotes: note?.trim() || before.resolutionNotes,
      },
    });
    await tx.complaintUpdate.create({ data: { complaintId: id, status, note: note?.trim(), createdById: actor.id } });
    return c;
  });

  await logAudit({ user: actor, action: "UPDATE", module: "complaints", entityType: "Complaint", entityId: id, oldValue: { status: before.status }, newValue: { status } });
  return updated;
}

export async function assignComplaint(actor: CurrentUser, id: string, assignedToId: string) {
  if (!can(actor, "complaints", "assign")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.complaint.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.complaint.update({ where: { id }, data: { assignedToId, status: "ASSIGNED" } });
    await tx.complaintUpdate.create({ data: { complaintId: id, status: "ASSIGNED", note: "Dossier affecte a un agent.", createdById: actor.id } });
    return c;
  });

  await logAudit({ user: actor, action: "ASSIGN", module: "complaints", entityType: "Complaint", entityId: id, newValue: { assignedToId } });
  return updated;
}
