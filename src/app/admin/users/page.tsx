import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listUsers } from "@/lib/services/users";
import { UserForm } from "@/components/users/user-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "users", "view")) redirect("/admin");

  const [users, roles, arrondissements, departments] = await Promise.all([
    listUsers(user),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Utilisateurs</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Comptes des agents et responsables municipaux, avec leurs roles et leur niveau organisationnel
            (Mairie Centrale ou arrondissement).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can(user, "users", "export") && (
            <a
              href="/api/users/export"
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-50"
            >
              Exporter (CSV)
            </a>
          )}
          {can(user, "users", "create") && (
            <UserForm
              roles={roles.map((r) => ({ id: r.id, label: r.name }))}
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              departments={departments.map((d) => ({ id: d.id, label: d.name }))}
              canCreateCentral={user.hasGlobalScope}
            />
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Roles</th>
              <th className="px-4 py-2.5">Perimetre</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 font-medium">{u.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                  <div>{u.email}</div>
                  {u.phone && <div className="text-xs">{u.phone}</div>}
                </td>
                <td className="px-4 py-2.5">{u.roles.map((r) => r.role.name).join(", ") || "—"}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                  {u.organizationLevel === "CENTRAL" ? (
                    <span>
                      Mairie Centrale
                      {u.department ? ` — ${u.department.name}` : ""}
                    </span>
                  ) : (
                    u.arrondissements.map((a) => a.arrondissement.code).join(", ") || "—"
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {u.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "users", "edit") && (
                    <ToggleActiveButton
                      endpoint={`/api/users/${u.id}`}
                      isActive={u.isActive}
                      disabled={u.id === user.id}
                    />
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun utilisateur dans votre perimetre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
