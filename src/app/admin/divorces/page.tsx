import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere, recordScopeWhere } from "@/lib/rbac";
import { listDivorces } from "@/lib/services/divorces";
import { DeclareDivorceForm } from "@/components/civil-status/declare-divorce-form";
import { ValidateButton } from "@/components/civil-status/validate-button";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declare", FINALIZED: "Finalise" };
const STATUS_CLASS: Record<string, string> = {
  DECLARED: "bg-amber-100 text-[var(--color-warning)]",
  FINALIZED: "bg-green-100 text-[var(--color-success)]",
};

export default async function DivorcesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "divorces", "view")) redirect("/admin");

  const [records, arrondissements, validMarriages] = await Promise.all([
    listDivorces(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.marriage.findMany({
      where: { ...recordScopeWhere(user), status: "VALID" },
      include: { husband: true, wife: true },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Divorces</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Dossiers de divorce et mise a jour de la situation matrimoniale.</p>
        </div>
        {can(user, "divorces", "create") && (
          <DeclareDivorceForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            marriages={validMarriages.map((m) => ({
              id: m.id,
              label: `${m.husband.firstName} ${m.husband.lastName} × ${m.wife.firstName} ${m.wife.lastName} (${m.recordNumber})`,
            }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Couple</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.recordNumber}</td>
                <td className="px-4 py-2.5">{r.marriage.husband.firstName} {r.marriage.husband.lastName} × {r.marriage.wife.firstName} {r.marriage.wife.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(r.divorceDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  {r.status === "DECLARED" && can(user, "divorces", "validate") && (
                    <ValidateButton endpoint={`/api/divorces/${r.id}`} />
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun dossier de divorce.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
