import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listDeathRecords } from "@/lib/services/deaths";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareDeathForm } from "@/components/civil-status/declare-death-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declare", REGISTERED: "Enregistre" };
const STATUS_CLASS: Record<string, string> = {
  DECLARED: "bg-amber-100 text-[var(--color-warning)]",
  REGISTERED: "bg-green-100 text-[var(--color-success)]",
};

export default async function DeathsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "deaths", "view")) redirect("/admin");

  const [records, arrondissements, citizens] = await Promise.all([
    listDeathRecords(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Deces</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Declaration et enregistrement des actes de deces.</p>
        </div>
        {can(user, "deaths", "create") && (
          <DeclareDeathForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            citizens={citizens.filter((c) => !c.isDeceased).map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Defunt</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.recordNumber}</td>
                <td className="px-4 py-2.5 font-medium">{r.deceased.firstName} {r.deceased.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(r.dateOfDeath).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    {r.status === "DECLARED" && can(user, "deaths", "validate") && (
                      <ValidateButton endpoint={`/api/deaths/${r.id}`} />
                    )}
                    {r.status === "REGISTERED" && can(user, "certificates", "create") && (
                      <IssueCertificateButton sourceType="death" sourceId={r.id} label="Certificat" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun acte de deces.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
