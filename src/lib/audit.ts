import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { recordScopeWhere } from "@/lib/rbac";

// Un simple {id, name} suffit (ex: juste apres authentification, avant que
// les roles/permissions ne soient charges) ; CurrentUser satisfait aussi ce type.
type AuditActor = { id: string; name: string } | null;

type LogAuditInput = {
  user: AuditActor;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  // Arrondissement de l'ENTITE concernee (pas celui de l'acteur) — ex. le
  // dossier de naissance valide, le paiement enregistre... Omettre (ou null)
  // pour une action de portee centrale/systeme (auth, gestion des comptes,
  // roles), qui reste visible uniquement depuis la Mairie Centrale. Meme
  // convention que recordScopeWhere() (voir rbac.ts).
  arrondissementId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  result?: "SUCCESS" | "FAILURE";
};

// Le journal d'audit n'est jamais modifiable/supprimable par les agents :
// c'est la seule fonction d'ecriture, appelee uniquement depuis le serveur.
export async function logAudit(input: LogAuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.user?.id ?? null,
      userName: input.user?.name ?? "Systeme",
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      arrondissementId: input.arrondissementId ?? null,
      oldValue: input.oldValue === undefined ? undefined : (input.oldValue as object),
      newValue: input.newValue === undefined ? undefined : (input.newValue as object),
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      result: input.result ?? "SUCCESS",
    },
  });
}

// Lecture du journal d'audit (section 20 / gap audit), meme convention de
// perimetre que tous les autres modules : Mairie Centrale voit tout, un
// arrondissement ne voit que les entrees rattachees a son propre perimetre
// (jamais les actions de portee centrale/systeme, arrondissementId = null).
export async function listAuditLogs(user: CurrentUser | null, moduleFilter?: string, take = 100) {
  return prisma.auditLog.findMany({
    where: { ...recordScopeWhere(user), ...(moduleFilter ? { module: moduleFilter } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });
}

const AUDIT_PAGE_SIZE = 25;

// Pagination reelle cote base pour l'ecran /admin/audit uniquement (meme
// constat que citizens.ts:listCitizensPage / payments.ts:listPaymentsPage —
// audit performance 2026-09-02). listAuditLogs() ci-dessus reste inchangee,
// toujours utilisee telle quelle par /api/audit, /api/audit/export et le
// widget "dernieres actions" du tableau de bord.
export async function listAuditLogsPage(user: CurrentUser | null, moduleFilter?: string, page = 1, pageSize = AUDIT_PAGE_SIZE) {
  const where = { ...recordScopeWhere(user), ...(moduleFilter ? { module: moduleFilter } : {}) };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export function requestMeta(req: Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");
  return { ipAddress, userAgent };
}
