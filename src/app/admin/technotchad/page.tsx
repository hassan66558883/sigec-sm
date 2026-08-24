import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getTechnoDashboardStats } from "@/lib/services/technotchad";

// Tableau de bord TECHNOTCHAD — KPIs minimaux (phase 1). Facturation,
// graphiques et alertes d'echeance sont hors perimetre de cette phase (voir
// les sections deferrees documentees dans docs/TECHNOTCHAD.md).
export default async function TechnotchadDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "technotchad_clients", "view") && !can(user, "technotchad_subscriptions", "view")) {
    redirect("/admin");
  }

  const { clientCount, activeSubscriptions, activeLicenses, expiringSoon } = await getTechnoDashboardStats();

  const cards = [
    { label: "Clients", value: clientCount, href: "/admin/technotchad/clients" },
    { label: "Abonnements actifs", value: activeSubscriptions, href: "/admin/technotchad/subscriptions" },
    { label: "Licences actives", value: activeLicenses, href: "/admin/technotchad/licenses" },
    { label: "Echeances < 30 jours", value: expiringSoon, href: "/admin/technotchad/subscriptions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">TECHNOTCHAD — Abonnements &amp; licences</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Espace commercial de l&apos;editeur TECHNOTCHAD, separe des donnees metier municipales de SIGEC-SM.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:border-[var(--color-primary)]"
          >
            <div className="text-2xl font-semibold text-[var(--color-text)]">{c.value}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
