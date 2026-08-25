import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getTechnoDashboardStats } from "@/lib/services/technotchad";
import { TechnoPageHeader } from "@/components/technotchad/page-header";
import { TechnoStatCard } from "@/components/technotchad/stat-card";
import { IconBuilding, IconLayers, IconKey, IconClock, IconSparkles } from "@/components/technotchad/icons";

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

  return (
    <div className="tc-scope space-y-6">
      <TechnoPageHeader
        title="Abonnements & licences"
        description="Espace commercial de l'editeur TECHNOTCHAD — clients, abonnements et licences du produit SIGEC-SM, isole des donnees metier municipales."
        icon={<IconSparkles className="h-5 w-5" />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TechnoStatCard
          label="Clients"
          value={clientCount}
          hint="Organisations abonnees"
          href="/admin/technotchad/clients"
          icon={<IconBuilding className="h-5 w-5" />}
          tone="indigo"
        />
        <TechnoStatCard
          label="Abonnements actifs"
          value={activeSubscriptions}
          hint="Tous produits confondus"
          href="/admin/technotchad/subscriptions"
          icon={<IconLayers className="h-5 w-5" />}
          tone="violet"
        />
        <TechnoStatCard
          label="Licences actives"
          value={activeLicenses}
          hint="Cles en cours de validite"
          href="/admin/technotchad/licenses"
          icon={<IconKey className="h-5 w-5" />}
          tone="emerald"
        />
        <TechnoStatCard
          label="Echeances < 30 jours"
          value={expiringSoon}
          hint="A renouveler bientot"
          href="/admin/technotchad/subscriptions"
          icon={<IconClock className="h-5 w-5" />}
          tone="amber"
        />
      </div>
    </div>
  );
}
