import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "audit", "view")) redirect("/admin");

  const { module } = await searchParams;

  const [logs, modules] = await Promise.all([
    prisma.auditLog.findMany({
      where: module ? { module } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.auditLog.findMany({ distinct: ["module"], select: { module: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Journal d&apos;audit</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Historique complet des actions sensibles. Lecture seule — non modifiable par les agents.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/audit"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!module ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
        >
          Tous
        </a>
        {modules.map((m) => (
          <a
            key={m.module}
            href={`/admin/audit?module=${m.module}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${module === m.module ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
          >
            {m.module}
          </a>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Utilisateur</th>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Module</th>
              <th className="px-4 py-2.5">Objet</th>
              <th className="px-4 py-2.5">Resultat</th>
              <th className="px-4 py-2.5">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                  {new Date(log.createdAt).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-2.5">{log.userName}</td>
                <td className="px-4 py-2.5">{log.action}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{log.module}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                  {log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}` : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.result === "SUCCESS" ? "bg-green-100 text-[var(--color-success)]" : "bg-red-100 text-[var(--color-danger)]"
                    }`}
                  >
                    {log.result}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{log.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune entree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
