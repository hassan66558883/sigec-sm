import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listMarriages, listMarriageRegimes } from "@/lib/services/marriages";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareMarriageForm } from "@/components/civil-status/declare-marriage-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declare", VALID: "Valide", DIVORCED: "Divorce", ANNULLED: "Annule" };
const STATUS_CLASS: Record<string, string> = {
  DECLARED: "bg-amber-100 text-[var(--color-warning)]",
  VALID: "bg-green-100 text-[var(--color-success)]",
  DIVORCED: "bg-gray-100 text-[var(--color-text-muted)]",
  ANNULLED: "bg-gray-100 text-[var(--color-text-muted)]",
};

export default async function MarriagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "marriages", "view")) redirect("/admin");

  const [records, arrondissements, citizens, regimes] = await Promise.all([
    listMarriages(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
    listMarriageRegimes(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Mariages</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Dossiers de mariage et regimes matrimoniaux.</p>
        </div>
        {can(user, "marriages", "create") && (
          <DeclareMarriageForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
            regimes={regimes.map((r) => ({ id: r.id, label: r.name }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Epoux</th>
              <th className="px-4 py-2.5">Epouse</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{r.recordNumber}</td>
                <td className="px-4 py-2.5">{r.husband.firstName} {r.husband.lastName}</td>
                <td className="px-4 py-2.5">{r.wife.firstName} {r.wife.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(r.marriageDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    {r.status === "DECLARED" && can(user, "marriages", "validate") && (
                      <ValidateButton endpoint={`/api/marriages/${r.id}`} />
                    )}
                    {r.status === "VALID" && can(user, "certificates", "create") && (
                      <IssueCertificateButton sourceType="marriage" sourceId={r.id} label="Certificat" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun dossier de mariage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
