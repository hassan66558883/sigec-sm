import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTechnoClients } from "@/lib/services/technotchad";
import { TechnoClientForm } from "@/components/technotchad/client-form";

export default async function TechnotchadClientsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "technotchad_clients", "view")) redirect("/admin");

  const clients = await listTechnoClients(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Clients TECHNOTCHAD</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Organisations clientes de l&apos;editeur TECHNOTCHAD (aujourd&apos;hui : la Ville de N&apos;Djamena).
        </p>
      </div>

      {can(user, "technotchad_clients", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter un client</h2>
          <TechnoClientForm />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Abonnements</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-medium">{c.legalName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{c.clientCode}</td>
                <td className="px-4 py-2.5">{c.clientType}</td>
                <td className="px-4 py-2.5">{c._count.subscriptions}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "ACTIVE" ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun client enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
