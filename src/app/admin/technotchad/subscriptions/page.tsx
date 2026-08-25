import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTechnoClients, listTechnoProducts, listTechnoPlans, listTechnoSubscriptions } from "@/lib/services/technotchad";
import { TechnoSubscriptionForm } from "@/components/technotchad/subscription-form";
import { ConfirmPostButton } from "@/components/technotchad/confirm-post-button";
import { TechnoPageHeader } from "@/components/technotchad/page-header";
import { TechnoStatusPill } from "@/components/technotchad/status-pill";
import { IconLayers } from "@/components/technotchad/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function TechnotchadSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "technotchad_subscriptions", "view")) redirect("/admin");

  const subscriptions = await listTechnoSubscriptions(user);
  const canCreate = can(user, "technotchad_subscriptions", "create");
  const [clients, products, plans] = canCreate
    ? await Promise.all([listTechnoClients(user), listTechnoProducts(user), listTechnoPlans(user)])
    : [[], [], []];

  return (
    <div className="tc-scope space-y-6">
      <TechnoPageHeader
        title="Abonnements TECHNOTCHAD"
        description="Abonnements des clients aux produits TECHNOTCHAD (SIGEC-SM aujourd'hui)."
        icon={<IconLayers className="h-5 w-5" />}
      />

      {canCreate && (
        <div className="tc-animate-in rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Creer un abonnement</h2>
          <TechnoSubscriptionForm
            clients={clients.map((c) => ({ id: c.id, legalName: c.legalName }))}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            plans={plans.map((p) => ({ id: p.id, productId: p.productId, name: p.name, price: p.price }))}
          />
        </div>
      )}

      <div className="tc-animate-in overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--tc-accent-soft)]/60 text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-5 py-3">Numero</th>
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Produit / Plan</th>
              <th className="px-5 py-3">Periode</th>
              <th className="px-5 py-3">Montant</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {subscriptions.map((s) => (
              <tr key={s.id} className="transition hover:bg-[var(--tc-accent-soft)]/40">
                <td className="px-5 py-3">
                  <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-[var(--color-text-muted)]">{s.subscriptionNumber}</span>
                </td>
                <td className="px-5 py-3 font-medium text-[var(--color-text)]">{s.client.legalName}</td>
                <td className="px-5 py-3 text-[var(--color-text)]">
                  {s.product.name}
                  <span className="mx-1.5 text-[var(--color-text-muted)]">·</span>
                  <span className="text-[var(--color-text-muted)]">{s.plan.name}</span>
                </td>
                <td className="px-5 py-3 text-xs text-[var(--color-text-muted)]">
                  {new Date(s.startDate).toLocaleDateString("fr-FR")} → {new Date(s.endDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-3 text-[var(--color-text)]">{formatFcfa(s.amount)}</td>
                <td className="px-5 py-3">
                  <TechnoStatusPill status={s.status} />
                </td>
                <td className="px-5 py-3">
                  {s.status === "ACTIVE" && can(user, "technotchad_subscriptions", "suspend") && (
                    <ConfirmPostButton endpoint={`/api/technotchad/subscriptions/${s.id}/suspend`} label="Suspendre" confirmLabel="Suspendre" />
                  )}
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-[var(--color-text-muted)]">
                  Aucun abonnement enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
