import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listUsers } from "@/lib/services/users";
import { UserForm } from "@/components/users/user-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { ResetUserPasswordButton } from "@/components/users/reset-user-password-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

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

  const columns: Column<UserRow>[] = [
    { key: "name", header: "Nom", render: (u) => <span className="font-medium">{u.name}</span>, sortable: true, sortValue: (u) => u.name },
    {
      key: "email",
      header: "Email",
      render: (u) => (
        <span className="text-[var(--color-text-muted)]">
          <span className="block">{u.email}</span>
          {u.phone && <span className="block text-xs">{u.phone}</span>}
        </span>
      ),
      sortable: true,
      sortValue: (u) => u.email,
    },
    {
      key: "roles",
      header: "Roles",
      render: (u) => u.roles.map((r) => r.role.name).join(", ") || "—",
      sortable: true,
      sortValue: (u) => u.roles.map((r) => r.role.name).join(", "),
    },
    {
      key: "scope",
      header: "Perimetre",
      render: (u) => (
        <span className="text-[var(--color-text-muted)]">
          {u.organizationLevel === "CENTRAL" ? (
            <>
              Mairie Centrale
              {u.department ? ` — ${u.department.name}` : ""}
            </>
          ) : (
            u.arrondissements.map((a) => a.arrondissement.code).join(", ") || "—"
          )}
        </span>
      ),
      sortable: true,
      sortValue: (u) => (u.organizationLevel === "CENTRAL" ? `Mairie Centrale ${u.department?.name ?? ""}` : u.arrondissements.map((a) => a.arrondissement.code).join(", ")),
    },
    {
      key: "status",
      header: "Statut",
      render: (u) => <StatusBadge label={u.isActive ? "Actif" : "Inactif"} tone={u.isActive ? "success" : "neutral"} />,
      sortable: true,
      sortValue: (u) => (u.isActive ? 1 : 0),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (u) =>
        can(user, "users", "edit") && (
          <div className="flex items-center justify-end gap-2">
            <ResetUserPasswordButton userId={u.id} />
            <ToggleActiveButton endpoint={`/api/users/${u.id}`} isActive={u.isActive} disabled={u.id === user.id} />
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Utilisateurs"
        description="Comptes des agents et responsables municipaux, avec leurs roles et leur niveau organisationnel."
        action={
          <>
            {can(user, "users", "export") && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
              <a href="/api/users/export" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]">
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
          </>
        }
      />

      <DataTable columns={columns} rows={users} keyField="id" emptyLabel="Aucun utilisateur dans votre perimetre." />
    </div>
  );
}
