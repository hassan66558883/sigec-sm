import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listAssociations } from "@/lib/services/associations";
import { listCitizens } from "@/lib/services/citizens";
import { AssociationForm } from "@/components/municipal/association-form";
import { StatusSelect } from "@/components/municipal/status-select";

const STATUS_LABEL: Record<string, string> = { REGISTERED: "Enregistree", SUSPENDED: "Suspendue", DISSOLVED: "Dissoute" };

export default async function AssociationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "associations", "view")) redirect("/admin");

  const [associations, arrondissements, citizens] = await Promise.all([
    listAssociations(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Associations & ONG</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Registre des associations et ONG locales.</p>
        </div>
        {can(user, "associations", "create") && (
          <AssociationForm
            arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Responsable</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {associations.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{a.registrationNumber}</td>
                <td className="px-4 py-2.5 font-medium">{a.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{a.type || "—"}</td>
                <td className="px-4 py-2.5">{a.leader ? `${a.leader.firstName} ${a.leader.lastName}` : "—"}</td>
                <td className="px-4 py-2.5">
                  {can(user, "associations", "edit") ? (
                    <StatusSelect
                      endpoint={`/api/associations/${a.id}`}
                      value={a.status}
                      options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
                    />
                  ) : (
                    STATUS_LABEL[a.status]
                  )}
                </td>
              </tr>
            ))}
            {associations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune association enregistree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
