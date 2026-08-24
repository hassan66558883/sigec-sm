import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTechnoClients, listTechnoProducts, listTechnoPlans, listTechnoSubscriptions } from "@/lib/services/technotchad";
import { TechnoSubscriptionForm } from "@/components/technotchad/subscription-form";
import { ConfirmPostButton } from "@/components/technotchad/confirm-post-button";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Abonnements TECHNOTCHAD</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Abonnements des clients aux produits TECHNOTCHAD (SIGEC-SM aujourd&apos;hui).
        </p>
      </div>

      {canCreate && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Creer un abonnement</h2>
          <TechnoSubscriptionForm
            clients={clients.map((c) => ({ id: c.id, legalName: c.legalName }))}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            plans={plans.map((p) => ({ id: p.id, productId: p.productId, name: p.name, price: p.price }))}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Produit / Plan</th>
              <th className="px-4 py-2.5">Periode</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {subscriptions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 font-mono text-xs">{s.subscriptionNumber}</td>
                <td className="px-4 py-2.5 font-medium">{s.client.legalName}</td>
                <td className="px-4 py-2.5">{s.product.name} — {s.plan.name}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                  {new Date(s.startDate).toLocaleDateString("fr-FR")} → {new Date(s.endDate).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "ACTIVE" ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {s.status === "ACTIVE" && can(user, "technotchad_subscriptions", "suspend") && (
                    <ConfirmPostButton endpoint={`/api/technotchad/subscriptions/${s.id}/suspend`} label="Suspendre" confirmLabel="Suspendre" />
                  )}
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
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
