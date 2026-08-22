import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listBirthRecords } from "@/lib/services/births";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareBirthForm } from "@/components/civil-status/declare-birth-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { RevokeButton } from "@/components/civil-status/revoke-button";

const STATUS_LABEL: Record<string, string> = {
  DECLARED: "Declaree",
  REGISTERED: "Enregistree",
  ANNULLED: "Annulee",
};
const STATUS_CLASS: Record<string, string> = {
  DECLARED: "bg-amber-100 text-[var(--color-warning)]",
  REGISTERED: "bg-green-100 text-[var(--color-success)]",
  ANNULLED: "bg-gray-100 text-[var(--color-text-muted)]",
};

export default async function BirthsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "births", "view")) redirect("/admin");

  const [records, arrondissements, citizens] = await Promise.all([
    listBirthRecords(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Naissances</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Declaration et enregistrement des actes de naissance.</p>
        </div>
        {can(user, "births", "create") && (
          <DeclareBirthForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Enfant</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.recordNumber}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/births/${r.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {r.child.firstName} {r.child.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(r.dateOfBirth).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    {r.status === "DECLARED" && can(user, "births", "validate") && (
                      <ValidateButton endpoint={`/api/births/${r.id}`} />
                    )}
                    {r.status !== "ANNULLED" && can(user, "births", "revoke") && (
                      <RevokeButton endpoint={`/api/births/${r.id}`} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune declaration de naissance.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
