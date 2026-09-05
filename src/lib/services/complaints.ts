import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { can, recordScopeWhere, canAccessArrondissement } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { generateRecordNumber } from "@/lib/ids";
import { ATTACHMENT_MAX_PER_COMPLAINT } from "@/lib/complaint-attachment-constants";

const CATEGORIES = ["VOIRIE", "PROPRETE", "ECLAIRAGE", "EAU", "SECURITE", "AUTRE"];

// Workflow a 13 etats (module Plaintes & Doleances). Remplace l'ancien
// statut simplifie a 7 valeurs (NEW/RECEIVED/ASSIGNED/IN_PROGRESS/PENDING/
// RESOLVED/CLOSED) — RESOLVED et CLOSED sont conserves tels quels (memes
// noms), le reste est nouveau. Chaque cle liste les transitions AUTORISEES
// depuis cet etat ; toute autre transition est refusee.
export const COMPLAINT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RECEIVED",
  "VERIFYING",
  "NEEDS_INFO",
  "ASSIGNED_DEPT",
  "ASSIGNED_AGENT",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "VALIDATING",
  "CLOSED",
  "REJECTED",
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["RECEIVED"],
  RECEIVED: ["VERIFYING"],
  VERIFYING: ["NEEDS_INFO", "ASSIGNED_DEPT", "REJECTED"],
  NEEDS_INFO: ["VERIFYING"],
  ASSIGNED_DEPT: ["ASSIGNED_AGENT"],
  ASSIGNED_AGENT: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING", "RESOLVED"],
  WAITING: ["IN_PROGRESS"],
  RESOLVED: ["VALIDATING"],
  VALIDATING: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  REJECTED: [],
};

export const COMPLAINT_PRIORITIES = ["FAIBLE", "NORMAL", "IMPORTANT", "URGENT", "CRITIQUE"] as const;
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];

// SLA configurable (section 16) — delai cible en heures, fige sur le
// dossier au moment de l'affectation a un agent (assignComplaintToAgent),
// jamais recalcule ensuite meme si la priorite change plus tard.
export const SLA_HOURS_BY_PRIORITY: Record<ComplaintPriority, number> = {
  FAIBLE: 15 * 24,
  NORMAL: 10 * 24,
  IMPORTANT: 5 * 24,
  URGENT: 48,
  CRITIQUE: 24,
};

export type SlaStatus = "ON_TIME" | "AT_RISK" | "LATE";

// "A risque" = moins de 24h restantes ou moins de 10% du delai cible
// restant (le plus court des deux), pour qu'une CRITIQUE (24h) ne reste pas
// "dans les delais" jusqu'a la derniere minute.
export function computeSlaStatus(dueAt: Date | null, resolvedAt: Date | null, slaHours: number | null, now = new Date()): SlaStatus | null {
  if (!dueAt) return null;
  const reference = resolvedAt ?? now;
  const msRemaining = dueAt.getTime() - reference.getTime();
  if (msRemaining < 0) return "LATE";
  const atRiskWindowMs = Math.min(24 * 60 * 60 * 1000, (slaHours ?? 24) * 60 * 60 * 1000 * 0.1);
  if (msRemaining < atRiskWindowMs) return "AT_RISK";
  return "ON_TIME";
}

type CitizenAccountWithCitizen = { id: string; citizen: { arrondissementId: string } };

// --- Cote citoyen (guichet numerique, section 13) --------------------------

export async function listMyComplaints(account: CitizenAccountWithCitizen) {
  return prisma.complaint.findMany({
    where: { citizenAccountId: account.id, deletedAt: null },
    include: {
      updates: { orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      categoryRef: true,
      satisfaction: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export type SubmitComplaintInput = {
  category: string;
  description: string;
  title?: string;
  type?: string;
  priority?: string;
  quartierId?: string;
  address?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  problemAt?: string;
};

const COMPLAINT_TYPES = ["PLAINTE", "DOLEANCE", "SIGNALEMENT", "SUGGESTION", "RECLAMATION", "INTERVENTION", "URGENCE"];

export async function submitComplaint(account: CitizenAccountWithCitizen, input: SubmitComplaintInput) {
  if (!CATEGORIES.includes(input.category)) throw new ApiError(400, "Categorie invalide.");
  if (!input.description?.trim()) throw new ApiError(400, "Description requise.");
  if (input.type && !COMPLAINT_TYPES.includes(input.type)) throw new ApiError(400, "Type de demande invalide.");
  // Coordonnees choisies par le citoyen sur la carte interactive (section 12) —
  // valider les bornes geographiques standard : une valeur hors plage ne peut
  // venir que d'un client altere, jamais d'un clic reel sur la carte.
  if (input.latitude !== undefined && (typeof input.latitude !== "number" || Number.isNaN(input.latitude) || input.latitude < -90 || input.latitude > 90)) {
    throw new ApiError(400, "Latitude invalide.");
  }
  if (input.longitude !== undefined && (typeof input.longitude !== "number" || Number.isNaN(input.longitude) || input.longitude < -180 || input.longitude > 180)) {
    throw new ApiError(400, "Longitude invalide.");
  }
  // Le citoyen ne peut jamais choisir une priorite superieure a NORMAL —
  // seul un agent peut requalifier vers IMPORTANT/URGENT/CRITIQUE (section 8 :
  // "empecher qu'un citoyen puisse artificiellement augmenter une priorite").
  const priority = input.priority === "FAIBLE" ? "FAIBLE" : "NORMAL";

  const category = await prisma.complaintCategory.findUnique({ where: { code: input.category } });

  const created = await prisma.complaint.create({
    data: {
      caseNumber: generateRecordNumber("PLT"),
      citizenAccountId: account.id,
      category: input.category,
      categoryId: category?.id,
      type: input.type ?? "PLAINTE",
      title: input.title?.trim() || undefined,
      description: input.description.trim(),
      priority,
      arrondissementId: account.citizen.arrondissementId,
      quartierId: input.quartierId,
      address: input.address?.trim(),
      landmark: input.landmark?.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      problemAt: input.problemAt ? new Date(input.problemAt) : undefined,
      updates: { create: { status: "SUBMITTED", note: "Plainte deposee par le citoyen.", createdById: account.id } },
    },
    include: { updates: true },
  });

  // user: null — meme convention que online-payments.ts (voir audit
  // 2026-09-04) : le depot d'une plainte n'avait jusqu'ici aucune trace
  // d'audit, seuls son traitement/son affectation cote agent l'etaient.
  await logAudit({
    user: null,
    action: "CREATE",
    module: "complaints",
    entityType: "Complaint",
    entityId: created.id,
    arrondissementId: created.arrondissementId,
    newValue: { caseNumber: created.caseNumber, category: created.category, citizenAccountId: account.id },
  });

  return created;
}

// --- Cote agents -------------------------------------------------------------

// Utilisee par la page /admin/complaints ET par /api/complaints — signature
// et forme de retour inchangees ici ; pagination reelle dans
// listComplaintsForStaffPage() ci-dessous.
export async function listComplaintsForStaff(user: CurrentUser) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  return prisma.complaint.findMany({
    where: { ...recordScopeWhere(user), deletedAt: null },
    include: { citizenAccount: { include: { citizen: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const DEFAULT_PAGE_SIZE = 25;

// Pagination reelle cote base (skip/take + count) pour l'ecran de liste
// /admin/complaints uniquement (voir audit performance 2026-09-02).
// Vues du tableau de bord agent (section 21) : chaque vue traduit un
// libelle metier ("Plaintes en retard", "A traiter aujourd'hui"...) en
// filtre Prisma applique cote base — jamais en filtrant une liste deja
// chargee en memoire (section 41 : "ne jamais charger des milliers de
// plaintes simultanement dans le navigateur").
export const COMPLAINT_DASHBOARD_VIEWS = ["all", "mine", "new", "urgent", "late", "today", "waiting", "resolved"] as const;
export type ComplaintDashboardView = (typeof COMPLAINT_DASHBOARD_VIEWS)[number];

const OPEN_STATUSES = { notIn: ["CLOSED", "REJECTED"] };
const ACTIVE_STATUSES = { notIn: ["CLOSED", "REJECTED", "RESOLVED", "VALIDATING"] };

function dashboardViewWhere(view: ComplaintDashboardView, userId: string, now: Date) {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  switch (view) {
    case "mine": return { assignedToId: userId };
    case "new": return { status: "SUBMITTED" };
    case "urgent": return { priority: { in: ["URGENT", "CRITIQUE"] }, status: OPEN_STATUSES };
    case "late": return { dueAt: { lt: now }, status: ACTIVE_STATUSES };
    case "today": return { dueAt: { gte: startOfDay, lte: endOfDay }, status: OPEN_STATUSES };
    case "waiting": return { status: "WAITING" };
    case "resolved": return { status: { in: ["RESOLVED", "VALIDATING", "CLOSED"] } };
    default: return {};
  }
}

export async function listComplaintsForStaffPage(
  user: CurrentUser,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  view: ComplaintDashboardView = "all",
) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  const where = { ...recordScopeWhere(user), deletedAt: null, mergedIntoId: null, ...dashboardViewWhere(view, user.id, new Date()) };
  const [rows, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: { citizenAccount: { include: { citizen: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.complaint.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

// Export CSV (section 31 : rapports/exports executifs) — meme perimetre
// territorial et memes filtres de vue que le tableau de bord, mais sans
// pagination : un export doit refleter le total reel, pas seulement la
// page affichee a l'ecran. Plafond de securite (5000 lignes) contre une
// requete degeneree, largement au-dessus de tout volume realiste pour
// Ville de N'Djamena — pas un cache-misere comme listPayments()'s take:100.
export async function listComplaintsForExport(user: CurrentUser, view: ComplaintDashboardView = "all") {
  if (!can(user, "complaints", "export")) throw new ApiError(403, "Permission insuffisante.");
  const where = { ...recordScopeWhere(user), deletedAt: null, mergedIntoId: null, ...dashboardViewWhere(view, user.id, new Date()) };
  return prisma.complaint.findMany({
    where,
    include: { citizenAccount: { include: { citizen: true } }, assignedDepartment: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

// KPI du tableau de bord agent/superviseur (section 21/23) — 8 requetes
// COUNT paralleles, jamais un fetch de toutes les lignes suivi d'un
// comptage cote application.
export async function getComplaintsDashboardStats(user: CurrentUser) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  const base = { ...recordScopeWhere(user), deletedAt: null, mergedIntoId: null };
  const now = new Date();

  const [total, mine, newCount, urgent, late, today, waiting, resolved] = await Promise.all([
    prisma.complaint.count({ where: base }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("mine", user.id, now) } }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("new", user.id, now) } }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("urgent", user.id, now) } }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("late", user.id, now) } }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("today", user.id, now) } }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("waiting", user.id, now) } }),
    prisma.complaint.count({ where: { ...base, ...dashboardViewWhere("resolved", user.id, now) } }),
  ]);

  return { total, mine, new: newCount, urgent, late, today, waiting, resolved };
}

export async function getComplaintForStaff(user: CurrentUser, id: string) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      citizenAccount: { include: { citizen: true } },
      updates: { orderBy: { createdAt: "asc" } },
      categoryRef: true,
      subcategoryRef: true,
      assignedDepartment: true,
      attachments: true,
      comments: { orderBy: { createdAt: "asc" } },
      satisfaction: true,
      escalations: { orderBy: { createdAt: "asc" } },
      mergedInto: true,
      mergedFrom: true,
    },
  });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(user, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");
  return complaint;
}

type TransitionOptions = { note?: string; rejectionReason?: string; resolutionNotes?: string };

// Coeur du moteur de workflow (section 12/13) : verifie la transition
// demandee contre COMPLAINT_TRANSITIONS, applique les horodatages de cycle
// de vie pertinents, et effectue le changement de statut de maniere
// atomique (updateMany + verification du statut source dans le WHERE,
// meme technique que births/marriages/deaths — voir audit concurrence
// 2026-09-04) : deux agents faisant avancer le meme dossier en parallele ne
// peuvent jamais produire une double transition silencieuse.
export async function transitionComplaint(actor: CurrentUser, id: string, toStatus: string, opts: TransitionOptions = {}) {
  if (!can(actor, "complaints", "update")) throw new ApiError(403, "Permission insuffisante.");
  if (!COMPLAINT_STATUSES.includes(toStatus as ComplaintStatus)) throw new ApiError(400, "Statut invalide.");

  const before = await prisma.complaint.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const allowed = COMPLAINT_TRANSITIONS[before.status as ComplaintStatus] ?? [];
  if (!allowed.includes(toStatus as ComplaintStatus)) {
    throw new ApiError(400, `Transition invalide : ${before.status} -> ${toStatus}.`);
  }
  if (toStatus === "REJECTED") {
    if (!can(actor, "complaints", "reject")) throw new ApiError(403, "Permission insuffisante pour rejeter.");
    if (!opts.rejectionReason?.trim()) throw new ApiError(400, "Un motif de rejet est requis.");
  }
  if (toStatus === "RESOLVED" && !can(actor, "complaints", "resolve")) {
    throw new ApiError(403, "Permission insuffisante pour resoudre.");
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: toStatus };
  if (toStatus === "RECEIVED") data.receivedAt = now;
  if (toStatus === "IN_PROGRESS" && !before.startedAt) data.startedAt = now;
  if (toStatus === "RESOLVED") {
    data.resolvedAt = now;
    if (opts.resolutionNotes?.trim()) data.resolutionNotes = opts.resolutionNotes.trim();
  }
  if (toStatus === "VALIDATING") data.validatedAt = now;
  if (toStatus === "CLOSED") data.closedAt = now;
  if (toStatus === "REJECTED") data.rejectionReason = opts.rejectionReason!.trim();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.complaint.updateMany({ where: { id, status: before.status }, data });
    if (result.count === 0) {
      throw new ApiError(409, "Ce dossier a ete modifie par un autre utilisateur entre-temps.");
    }
    await tx.complaintUpdate.create({ data: { complaintId: id, status: toStatus, note: opts.note?.trim(), createdById: actor.id } });
    return tx.complaint.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "TRANSITION",
    module: "complaints",
    entityType: "Complaint",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { status: before.status },
    newValue: { status: toStatus },
  });

  return updated;
}

// Affectation a un service (section 14/15) — premiere etape de
// l'affectation, avant la designation d'un agent precis.
export async function assignComplaintToDepartment(actor: CurrentUser, id: string, departmentId: string) {
  if (!can(actor, "complaints", "assign")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.complaint.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const allowed = COMPLAINT_TRANSITIONS[before.status as ComplaintStatus] ?? [];
  if (!allowed.includes("ASSIGNED_DEPT")) throw new ApiError(400, `Transition invalide : ${before.status} -> ASSIGNED_DEPT.`);

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) throw new ApiError(404, "Service introuvable.");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.complaint.updateMany({
      where: { id, status: before.status },
      data: { status: "ASSIGNED_DEPT", assignedDepartmentId: departmentId },
    });
    if (result.count === 0) throw new ApiError(409, "Ce dossier a ete modifie par un autre utilisateur entre-temps.");
    await tx.complaintUpdate.create({
      data: { complaintId: id, status: "ASSIGNED_DEPT", note: `Dossier affecte au service ${department.name}.`, createdById: actor.id },
    });
    return tx.complaint.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "ASSIGN_DEPARTMENT",
    module: "complaints",
    entityType: "Complaint",
    entityId: id,
    arrondissementId: before.arrondissementId,
    newValue: { departmentId },
  });

  return updated;
}

// Designation de l'agent responsable (section 15) — c'est ce moment qui
// declenche le calcul du SLA (section 16) : le delai cible est fige des
// maintenant selon la priorite du dossier, jamais recalcule apres coup meme
// si la priorite change plus tard.
export async function assignComplaintToAgent(actor: CurrentUser, id: string, agentUserId: string) {
  if (!can(actor, "complaints", "assign")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.complaint.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const allowed = COMPLAINT_TRANSITIONS[before.status as ComplaintStatus] ?? [];
  if (!allowed.includes("ASSIGNED_AGENT")) throw new ApiError(400, `Transition invalide : ${before.status} -> ASSIGNED_AGENT.`);

  const agent = await prisma.user.findUnique({ where: { id: agentUserId } });
  if (!agent || !agent.isActive) throw new ApiError(400, "Agent invalide ou inactif.");

  const now = new Date();
  const slaHours = SLA_HOURS_BY_PRIORITY[before.priority as ComplaintPriority] ?? SLA_HOURS_BY_PRIORITY.NORMAL;
  const dueAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.complaint.updateMany({
      where: { id, status: before.status },
      data: { status: "ASSIGNED_AGENT", assignedToId: agentUserId, assignedAt: now, slaHours, dueAt },
    });
    if (result.count === 0) throw new ApiError(409, "Ce dossier a ete modifie par un autre utilisateur entre-temps.");
    await tx.complaintUpdate.create({
      data: { complaintId: id, status: "ASSIGNED_AGENT", note: `Agent assigne : ${agent.name}.`, createdById: actor.id },
    });
    return tx.complaint.findUniqueOrThrow({ where: { id } });
  });

  await logAudit({
    user: actor,
    action: "ASSIGN_AGENT",
    module: "complaints",
    entityType: "Complaint",
    entityId: id,
    arrondissementId: before.arrondissementId,
    newValue: { agentUserId, dueAt, slaHours },
  });

  return updated;
}

// Requalification de priorite (section 8 : seul un agent peut elever une
// priorite au-dela de FAIBLE/NORMAL). N'affecte pas le SLA deja fige si le
// dossier a deja ete assigne a un agent — recalculer retroactivement un
// SLA deja communique au citoyen serait trompeur ; seule une nouvelle
// affectation recalcule le SLA.
export async function requalifyComplaintPriority(actor: CurrentUser, id: string, priority: string) {
  if (!can(actor, "complaints", "update")) throw new ApiError(403, "Permission insuffisante.");
  if (!COMPLAINT_PRIORITIES.includes(priority as ComplaintPriority)) throw new ApiError(400, "Priorite invalide.");
  const before = await prisma.complaint.findUnique({ where: { id } });
  if (!before || before.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, before.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const updated = await prisma.complaint.update({ where: { id }, data: { priority } });

  await logAudit({
    user: actor,
    action: "REQUALIFY_PRIORITY",
    module: "complaints",
    entityType: "Complaint",
    entityId: id,
    arrondissementId: before.arrondissementId,
    oldValue: { priority: before.priority },
    newValue: { priority },
  });

  return updated;
}

// --- Categories administrables (section 6) ----------------------------------

export async function listComplaintCategories() {
  return prisma.complaintCategory.findMany({
    where: { isActive: true },
    include: { subcategories: { where: { isActive: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createComplaintCategory(actor: CurrentUser, input: { code: string; name: string }) {
  if (!can(actor, "complaints", "manage_categories")) throw new ApiError(403, "Permission insuffisante.");
  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();
  if (!code || !name) throw new ApiError(400, "Code et nom requis.");

  const created = await prisma.complaintCategory.create({ data: { code, name } });

  await logAudit({ user: actor, action: "CREATE", module: "complaints", entityType: "ComplaintCategory", entityId: created.id, newValue: { code, name } });
  return created;
}

export async function setComplaintCategoryActive(actor: CurrentUser, id: string, isActive: boolean) {
  if (!can(actor, "complaints", "manage_categories")) throw new ApiError(403, "Permission insuffisante.");
  const before = await prisma.complaintCategory.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Categorie introuvable.");

  const updated = await prisma.complaintCategory.update({ where: { id }, data: { isActive } });

  await logAudit({ user: actor, action: "UPDATE", module: "complaints", entityType: "ComplaintCategory", entityId: id, oldValue: { isActive: before.isActive }, newValue: { isActive } });
  return updated;
}

export async function createComplaintSubcategory(actor: CurrentUser, categoryId: string, input: { code: string; name: string }) {
  if (!can(actor, "complaints", "manage_categories")) throw new ApiError(403, "Permission insuffisante.");
  const code = input.code?.trim().toUpperCase();
  const name = input.name?.trim();
  if (!code || !name) throw new ApiError(400, "Code et nom requis.");
  const category = await prisma.complaintCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(404, "Categorie introuvable.");

  const created = await prisma.complaintSubcategory.create({ data: { categoryId, code, name } });

  await logAudit({ user: actor, action: "CREATE", module: "complaints", entityType: "ComplaintSubcategory", entityId: created.id, newValue: { categoryId, code, name } });
  return created;
}

// --- Satisfaction citoyenne (section 28) ------------------------------------

const WAS_RESOLVED_VALUES = ["OUI", "PARTIEL", "NON"];

export async function submitComplaintSatisfaction(
  account: CitizenAccountWithCitizen,
  complaintId: string,
  input: { wasResolved: string; rating: number; comment?: string },
) {
  if (!WAS_RESOLVED_VALUES.includes(input.wasResolved)) throw new ApiError(400, "Valeur invalide.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new ApiError(400, "Note invalide (1 a 5).");

  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (complaint.citizenAccountId !== account.id) throw new ApiError(403, "Ce dossier ne vous appartient pas.");
  if (complaint.status !== "CLOSED" && complaint.status !== "RESOLVED") {
    throw new ApiError(400, "Le dossier doit d'abord etre resolu avant de pouvoir etre evalue.");
  }

  const existing = await prisma.complaintSatisfaction.findUnique({ where: { complaintId } });
  if (existing) throw new ApiError(409, "Ce dossier a deja ete evalue.");

  const created = await prisma.complaintSatisfaction.create({
    data: { complaintId, wasResolved: input.wasResolved, rating: input.rating, comment: input.comment?.trim() },
  });

  await logAudit({
    user: null,
    action: "SATISFACTION",
    module: "complaints",
    entityType: "Complaint",
    entityId: complaintId,
    arrondissementId: complaint.arrondissementId,
    newValue: { wasResolved: input.wasResolved, rating: input.rating },
  });

  return created;
}

// --- Messagerie citoyen <-> mairie (section 18) -----------------------------

export async function addComplaintCommentAsCitizen(account: CitizenAccountWithCitizen, complaintId: string, message: string) {
  if (!message?.trim()) throw new ApiError(400, "Message requis.");
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (complaint.citizenAccountId !== account.id) throw new ApiError(403, "Ce dossier ne vous appartient pas.");

  return prisma.complaintComment.create({
    data: { complaintId, authorType: "CITIZEN", authorCitizenId: account.id, message: message.trim() },
  });
}

export async function addComplaintCommentAsStaff(actor: CurrentUser, complaintId: string, message: string) {
  if (!can(actor, "complaints", "update")) throw new ApiError(403, "Permission insuffisante.");
  if (!message?.trim()) throw new ApiError(400, "Message requis.");
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const created = await prisma.complaintComment.create({
    data: { complaintId, authorType: "STAFF", authorUserId: actor.id, message: message.trim() },
  });

  await logAudit({
    user: actor,
    action: "COMMENT",
    module: "complaints",
    entityType: "Complaint",
    entityId: complaintId,
    arrondissementId: complaint.arrondissementId,
    newValue: { message: message.trim() },
  });
  return created;
}

// --- Escalade (section 27) ---------------------------------------------------

export const ESCALATION_LEVELS = ["AGENT", "SUPERVISOR", "DIRECTOR", "CENTRAL_ADMIN"] as const;

// Trace un saut de niveau, independamment du statut/workflow du dossier
// (un dossier peut etre escalade sans changer de statut — l'escalade
// concerne QUI est responsable de le debloquer, pas ou il en est dans le
// cycle de vie). Le niveau de depart est deduis de la derniere escalade
// enregistree, ou "AGENT" par defaut (premier niveau).
export async function escalateComplaint(actor: CurrentUser, id: string, toLevel: string, reason?: string) {
  if (!can(actor, "complaints", "assign")) throw new ApiError(403, "Permission insuffisante.");
  if (!ESCALATION_LEVELS.includes(toLevel as (typeof ESCALATION_LEVELS)[number])) throw new ApiError(400, "Niveau invalide.");

  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");

  const lastEscalation = await prisma.complaintEscalation.findFirst({ where: { complaintId: id }, orderBy: { createdAt: "desc" } });
  const fromLevel = lastEscalation?.toLevel ?? "AGENT";
  if (fromLevel === toLevel) throw new ApiError(400, "Ce dossier est deja a ce niveau.");

  const created = await prisma.complaintEscalation.create({
    data: { complaintId: id, fromLevel, toLevel, reason: reason?.trim(), createdById: actor.id },
  });

  await logAudit({
    user: actor,
    action: "ESCALATE",
    module: "complaints",
    entityType: "Complaint",
    entityId: id,
    arrondissementId: complaint.arrondissementId,
    oldValue: { level: fromLevel },
    newValue: { level: toLevel, reason: reason?.trim() },
  });

  return created;
}

// --- Detection de doublons (section 26) -------------------------------------
// Heuristique volontairement simple et transparente (pas de similarite
// textuelle/ML) : meme categorie, meme localisation (quartier si connu,
// sinon arrondissement), dossier encore actif, cree dans les 30 derniers
// jours. Mieux vaut rater un doublon que proposer une fusion hasardeuse
// entre deux dossiers sans rapport reel — jamais de fusion automatique
// (section 26 : "ne jamais supprimer automatiquement... sans regle claire").
const DUPLICATE_WINDOW_DAYS = 30;

export async function findSimilarComplaints(user: CurrentUser, complaintId: string) {
  if (!can(user, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(user, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");
  if (complaint.mergedIntoId) return [];

  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return prisma.complaint.findMany({
    where: {
      id: { not: complaintId },
      deletedAt: null,
      mergedIntoId: null,
      category: complaint.category,
      ...(complaint.quartierId ? { quartierId: complaint.quartierId } : { arrondissementId: complaint.arrondissementId }),
      status: ACTIVE_STATUSES,
      createdAt: { gte: since },
    },
    include: { citizenAccount: { include: { citizen: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function mergeComplaints(actor: CurrentUser, keepId: string, mergeId: string) {
  if (!can(actor, "complaints", "assign")) throw new ApiError(403, "Permission insuffisante.");
  if (keepId === mergeId) throw new ApiError(400, "Un dossier ne peut pas etre fusionne avec lui-meme.");

  const [keep, merge] = await Promise.all([
    prisma.complaint.findUnique({ where: { id: keepId } }),
    prisma.complaint.findUnique({ where: { id: mergeId } }),
  ]);
  if (!keep || keep.deletedAt) throw new ApiError(404, "Dossier a conserver introuvable.");
  if (!merge || merge.deletedAt) throw new ApiError(404, "Dossier a fusionner introuvable.");
  if (!canAccessArrondissement(actor, keep.arrondissementId) || !canAccessArrondissement(actor, merge.arrondissementId)) {
    throw new ApiError(403, "Dossier hors de votre perimetre.");
  }
  if (merge.mergedIntoId) throw new ApiError(400, "Ce dossier a deja ete fusionne.");
  if (keep.mergedIntoId) throw new ApiError(400, "Le dossier a conserver est lui-meme fusionne dans un autre.");

  const [updated] = await prisma.$transaction([
    prisma.complaint.update({ where: { id: mergeId }, data: { mergedIntoId: keepId } }),
    prisma.complaintUpdate.create({
      data: { complaintId: mergeId, status: merge.status, note: `Dossier fusionne avec ${keep.caseNumber}.`, createdById: actor.id },
    }),
  ]);

  await logAudit({
    user: actor,
    action: "MERGE",
    module: "complaints",
    entityType: "Complaint",
    entityId: mergeId,
    arrondissementId: merge.arrondissementId,
    oldValue: { mergedIntoId: null },
    newValue: { mergedIntoId: keepId, keptCaseNumber: keep.caseNumber },
  });

  return updated;
}

// --- Pieces jointes (section 9) ----------------------------------------------
// Metadonnees uniquement ici — l'ecriture/lecture du fichier sur disque vit
// dans lib/complaint-attachments.ts (validation mime/taille, generation du
// nom de fichier). Ces fonctions ne font que l'autorisation + la ligne DB.

type AttachmentFileMeta = { fileName: string; storagePath: string; mimeType: string; sizeBytes: number };

async function assertAttachmentQuota(complaintId: string) {
  const count = await prisma.complaintAttachment.count({ where: { complaintId } });
  if (count >= ATTACHMENT_MAX_PER_COMPLAINT) {
    throw new ApiError(400, `Maximum ${ATTACHMENT_MAX_PER_COMPLAINT} pieces jointes par dossier.`);
  }
}

// Appelee AVANT d'ecrire le fichier sur disque (voir la route d'upload) —
// evite d'ecrire un fichier orphelin si l'autorisation echoue ensuite.
export async function assertCanAttachToComplaintAsCitizen(account: CitizenAccountWithCitizen, complaintId: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (complaint.citizenAccountId !== account.id) throw new ApiError(403, "Ce dossier ne vous appartient pas.");
  await assertAttachmentQuota(complaintId);
  return complaint;
}

export async function assertCanAttachToComplaintAsStaff(actor: CurrentUser, complaintId: string) {
  if (!can(actor, "complaints", "update")) throw new ApiError(403, "Permission insuffisante.");
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");
  await assertAttachmentQuota(complaintId);
  return complaint;
}

export async function addComplaintAttachmentAsCitizen(account: CitizenAccountWithCitizen, complaintId: string, file: AttachmentFileMeta) {
  const complaint = await assertCanAttachToComplaintAsCitizen(account, complaintId);

  const created = await prisma.complaintAttachment.create({
    data: { complaintId, uploadedByCitizenAccountId: account.id, ...file },
  });

  await logAudit({
    user: null,
    action: "ATTACHMENT_ADD",
    module: "complaints",
    entityType: "Complaint",
    entityId: complaintId,
    arrondissementId: complaint.arrondissementId,
    newValue: { fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, citizenAccountId: account.id },
  });

  return created;
}

export async function addComplaintAttachmentAsStaff(actor: CurrentUser, complaintId: string, file: AttachmentFileMeta) {
  const complaint = await assertCanAttachToComplaintAsStaff(actor, complaintId);

  const created = await prisma.complaintAttachment.create({
    data: { complaintId, uploadedByUserId: actor.id, ...file },
  });

  await logAudit({
    user: actor,
    action: "ATTACHMENT_ADD",
    module: "complaints",
    entityType: "Complaint",
    entityId: complaintId,
    arrondissementId: complaint.arrondissementId,
    newValue: { fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
  });

  return created;
}

export async function getComplaintAttachmentForCitizen(account: CitizenAccountWithCitizen, complaintId: string, attachmentId: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (complaint.citizenAccountId !== account.id) throw new ApiError(403, "Ce dossier ne vous appartient pas.");
  const attachment = await prisma.complaintAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.complaintId !== complaintId) throw new ApiError(404, "Piece jointe introuvable.");
  return attachment;
}

export async function getComplaintAttachmentForStaff(actor: CurrentUser, complaintId: string, attachmentId: string) {
  if (!can(actor, "complaints", "view")) throw new ApiError(403, "Permission insuffisante.");
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.deletedAt) throw new ApiError(404, "Plainte introuvable.");
  if (!canAccessArrondissement(actor, complaint.arrondissementId)) throw new ApiError(403, "Plainte hors de votre perimetre.");
  const attachment = await prisma.complaintAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.complaintId !== complaintId) throw new ApiError(404, "Piece jointe introuvable.");
  return attachment;
}
