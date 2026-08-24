import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTechnoLicenses } from "@/lib/services/technotchad";
import { ConfirmPostButton } from "@/components/technotchad/confirm-post-button";

export default async function TechnotchadLicensesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "technotchad_licenses", "view")) redirect("/admin");

  const licenses = await listTechnoLicenses(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Licences TECHNOTCHAD</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Une licence par abonnement, generee automatiquement a la creation de l&apos;abonnement.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Cle de licence</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Produit</th>
              <th className="px-4 py-2.5">Expiration</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {licenses.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{l.licenseKey}</td>
                <td className="px-4 py-2.5 font-medium">{l.client.legalName}</td>
                <td className="px-4 py-2.5">{l.product.name}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{new Date(l.expiresAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      l.status === "ACTIVE" ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {l.status === "ACTIVE" && can(user, "technotchad_licenses", "revoke") && (
                    <ConfirmPostButton endpoint={`/api/technotchad/licenses/${l.id}/revoke`} label="Revoquer" confirmLabel="Revoquer" />
                  )}
                </td>
              </tr>
            ))}
            {licenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
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
