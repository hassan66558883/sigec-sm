import { prisma } from "@/lib/db";

// Un simple {id, name} suffit (ex: juste apres authentification, avant que
// les roles/permissions ne soient charges) ; CurrentUser satisfait aussi ce type.
type AuditActor = { id: string; name: string } | null;

type LogAuditInput = {
  user: AuditActor;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
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
      oldValue: input.oldValue === undefined ? undefined : (input.oldValue as object),
      newValue: input.newValue === undefined ? undefined : (input.newValue as object),
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      result: input.result ?? "SUCCESS",
    },
  });
}

export function requestMeta(req: Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");
  return { ipAddress, userAgent };
}
