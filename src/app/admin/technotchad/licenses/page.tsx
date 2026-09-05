import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTechnoLicenses } from "@/lib/services/technotchad";
import { ConfirmPostButton } from "@/components/technotchad/confirm-post-button";
import { TechnoPageHeader } from "@/components/technotchad/page-header";
import { TechnoStatusPill } from "@/components/technotchad/status-pill";
import { CopyButton } from "@/components/technotchad/copy-button";
import { IconKey } from "@/components/technotchad/icons";

export default async function TechnotchadLicensesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "technotchad_licenses", "view")) redirect("/admin");

  const licenses = await listTechnoLicenses(user);

  return (
    <div className="tc-scope space-y-6">
      <TechnoPageHeader
        title="Licences TECHNOTCHAD"
        description="Une licence par abonnement, generee automatiquement a la creation de l'abonnement."
        icon={<IconKey className="h-5 w-5" />}
      />

      <div className="tc-animate-in overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--tc-accent-soft)]/60 text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-5 py-3">Cle de licence</th>
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Produit</th>
              <th className="px-5 py-3">Expiration</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {licenses.map((l) => (
              <tr key={l.id} className="transition hover:bg-[var(--tc-accent-soft)]/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs tracking-tight text-[var(--color-text-muted)] dark:bg-white/10">{l.licenseKey}</span>
                    <CopyButton value={l.licenseKey} />
                  </div>
                </td>
                <td className="px-5 py-3 font-medium text-[var(--color-text)]">{l.client.legalName}</td>
                <td className="px-5 py-3 text-[var(--color-text)]">{l.product.name}</td>
                <td className="px-5 py-3 text-xs text-[var(--color-text-muted)]">{new Date(l.expiresAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-5 py-3">
                  <TechnoStatusPill status={l.status} />
                </td>
                <td className="px-5 py-3">
                  {l.status === "ACTIVE" && can(user, "technotchad_licenses", "revoke") && (
                    <ConfirmPostButton endpoint={`/api/technotchad/licenses/${l.id}/revoke`} label="Revoquer" confirmLabel="Revoquer" />
                  )}
                </td>
              </tr>
            ))}
            {licenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-text-muted)]">
                  Aucune licence generee.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
