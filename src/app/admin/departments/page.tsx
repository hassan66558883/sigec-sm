import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listDepartments } from "@/lib/services/departments";
import { DepartmentForm } from "@/components/departments/department-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";

export default async function DepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "departments", "view")) redirect("/admin");

  const departments = await listDepartments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Services centraux</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Directions de la Mairie Centrale (Etat civil, Finances, Urbanisme...). Organisationnel uniquement —
          n&apos;affecte pas le perimetre territorial des arrondissements.
        </p>
      </div>

      {can(user, "departments", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter une direction</h2>
          <DepartmentForm />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Direction</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Utilisateurs</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {departments.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium">{d.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{d.code}</td>
                <td className="px-4 py-2.5">{d._count.users}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.isActive ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {d.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "departments", "edit") && (
                    <ToggleActiveButton endpoint={`/api/departments/${d.id}`} isActive={d.isActive} />
                  )}
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune direction centrale enregistree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
