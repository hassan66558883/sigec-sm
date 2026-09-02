import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listRoles, listPermissions } from "@/lib/services/roles";
import { RoleForm } from "@/components/roles/role-form";
import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { PageHeading } from "@/components/ui/page-header";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "roles", "view")) redirect("/admin");

  const [roles, permissions] = await Promise.all([listRoles(), listPermissions()]);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Roles & permissions"
        description="Controle d'acces base sur les roles (RBAC), granulaire par module et par action."
        action={can(user, "roles", "create") && <RoleForm />}
      />

      <div className="space-y-4">
        {roles.map((role) => (
          <details key={role.id} className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm" open={!role.isSystem}>
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]">
              <span>
                {role.name} <span className="font-normal text-[var(--color-text-muted)]">({role.code})</span>
              </span>
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                {role._count.users} utilisateur(s)
              </span>
            </summary>
            <div className="border-t border-[var(--color-border)] p-4">
              <RolePermissionsEditor
                roleId={role.id}
                roleCode={role.code}
                allPermissions={permissions}
                initialPermissionIds={role.permissions.map((rp) => rp.permissionId)}
                editable={can(user, "roles", "edit") && role.code !== "SUPER_ADMIN"}
              />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
