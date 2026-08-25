import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTechnoClients } from "@/lib/services/technotchad";
import { TechnoClientForm } from "@/components/technotchad/client-form";
import { TechnoPageHeader } from "@/components/technotchad/page-header";
import { TechnoStatusPill } from "@/components/technotchad/status-pill";
import { IconBuilding } from "@/components/technotchad/icons";

const TYPE_LABELS: Record<string, string> = {
  MAIRIE: "Mairie",
  ENTREPRISE: "Entreprise",
  ADMINISTRATION: "Administration",
  ONG: "ONG",
  ASSOCIATION: "Association",
  PARTICULIER: "Particulier",
  AUTRE: "Autre",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? [parts[0][0], parts[1][0]] : [name.slice(0, 2)];
  return chars.join("").toUpperCase();
}

export default async function TechnotchadClientsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "technotchad_clients", "view")) redirect("/admin");

  const clients = await listTechnoClients(user);

  return (
    <div className="tc-scope space-y-6">
      <TechnoPageHeader
        title="Clients TECHNOTCHAD"
        description="Organisations clientes de l'editeur TECHNOTCHAD (aujourd'hui : la Ville de N'Djamena)."
        icon={<IconBuilding className="h-5 w-5" />}
      />

      {can(user, "technotchad_clients", "create") && (
        <div className="tc-animate-in rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Ajouter un client</h2>
          <TechnoClientForm />
        </div>
      )}

      <div className="tc-animate-in overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--tc-accent-soft)]/60 text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Abonnements</th>
              <th className="px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {clients.map((c) => (
              <tr key={c.id} className="transition hover:bg-[var(--tc-accent-soft)]/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--tc-grad-from), var(--tc-grad-to))" }}
                    >
                      {initials(c.legalName)}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--color-text)]">{c.legalName}</div>
                      {c.commercialName && <div className="text-xs text-[var(--color-text-muted)]">{c.commercialName}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-muted)]">{c.clientCode}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    {TYPE_LABELS[c.clientType] ?? c.clientType}
                  </span>
                </td>
                <td className="px-5 py-3 text-[var(--color-text)]">{c._count.subscriptions}</td>
                <td className="px-5 py-3">
                  <TechnoStatusPill status={c.status} />
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[var(--color-text-muted)]">
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
