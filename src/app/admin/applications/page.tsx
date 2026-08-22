import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listApplicationsForStaff } from "@/lib/services/applications";
import { ApplicationActions } from "@/components/civil-status/application-actions";

const TYPE_LABEL: Record<string, string> = {
  BIRTH_CERTIFICATE_COPY: "Copie d'acte de naissance",
  MARRIAGE_CERTIFICATE_COPY: "Copie d'acte de mariage",
  DEATH_CERTIFICATE_COPY: "Copie d'acte de deces",
};
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  IN_REVIEW: "En traitement",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
  COMPLETED: "Terminee",
};
const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-[var(--color-warning)]",
  IN_REVIEW: "bg-amber-100 text-[var(--color-warning)]",
  APPROVED: "bg-green-100 text-[var(--color-success)]",
  COMPLETED: "bg-green-100 text-[var(--color-success)]",
  REJECTED: "bg-red-100 text-[var(--color-danger)]",
};

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "applications", "view")) redirect("/admin");

  const applications = await listApplicationsForStaff(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Demandes citoyennes</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          File de traitement des demandes soumises depuis le portail citoyen.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Citoyen</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {applications.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{a.applicationNumber}</td>
                <td className="px-4 py-2.5">
                  {a.citizenAccount.citizen.firstName} {a.citizenAccount.citizen.lastName}
                </td>
                <td className="px-4 py-2.5">{TYPE_LABEL[a.type]}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </td>
                <td className="px-4 py-2.5">
                  {(a.status === "SUBMITTED" || a.status === "IN_REVIEW") && (
                    <ApplicationActions
                      id={a.id}
                      canApprove={can(user, "applications", "approve")}
                      canReject={can(user, "applications", "reject")}
                    />
                  )}
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune demande a traiter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
