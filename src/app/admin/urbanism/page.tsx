import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere, recordScopeWhere } from "@/lib/rbac";
import { listUrbanCases } from "@/lib/services/urbanism";
import { listCitizens } from "@/lib/services/citizens";
import { SubmitCaseForm } from "@/components/urbanism/submit-case-form";
import { CaseWorkflowActions } from "@/components/urbanism/case-workflow-actions";

const TYPE_LABEL: Record<string, string> = { BUILDING_PERMIT: "Permis de construire", DEMOLITION_PERMIT: "Autorisation de demolition" };
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  UNDER_REVIEW: "En instruction",
  INSPECTED: "Controlee",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
};
const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-[var(--color-warning)]",
  UNDER_REVIEW: "bg-amber-100 text-[var(--color-warning)]",
  INSPECTED: "bg-amber-100 text-[var(--color-warning)]",
  APPROVED: "bg-green-100 text-[var(--color-success)]",
  REJECTED: "bg-red-100 text-[var(--color-danger)]",
};

export default async function UrbanismPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "urbanism", "view")) redirect("/admin");

  const [cases, parcels, citizens, arrondissements] = await Promise.all([
    listUrbanCases(user),
    prisma.landParcel.findMany({ where: recordScopeWhere(user), take: 100 }),
    listCitizens(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Urbanisme</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Permis de construire et autorisations de demolition.</p>
        </div>
        {can(user, "urbanism", "create") && (
          <SubmitCaseForm
            parcels={parcels.map((p) => ({ id: p.id, label: p.parcelNumber }))}
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Demandeur</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {cases.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                  <Link href={`/admin/urbanism/${c.id}`} className="text-[var(--color-primary)] hover:underline">
                    {c.caseNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{TYPE_LABEL[c.type]}</td>
                <td className="px-4 py-2.5">{c.applicant.firstName} {c.applicant.lastName}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  <CaseWorkflowActions
                    id={c.id}
                    status={c.status}
                    canReview={can(user, "urbanism", "review")}
                    canInspect={can(user, "urbanism", "inspect")}
                    canDecide={can(user, "urbanism", "decide")}
                  />
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun dossier d&apos;urbanisme.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
