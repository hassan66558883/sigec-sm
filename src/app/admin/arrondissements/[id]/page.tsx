import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, canAccessArrondissement } from "@/lib/rbac";
import { listQuartiers } from "@/lib/services/territorial";
import { getArrondissementStatsReport } from "@/lib/services/analytics";
import { QuartierForm } from "@/components/territorial/quartier-form";
import { ToggleActiveButton } from "@/components/toggle-active-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconUsersGroup, IconActivity, IconCoins, IconClipboardList, IconBuildingOffice, IconMapPin } from "@/components/icons";

type QuartierRow = Awaited<ReturnType<typeof listQuartiers>>[number];

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function ArrondissementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const arrondissement = await prisma.arrondissement.findUnique({ where: { id }, include: { city: true } });
  if (!arrondissement) notFound();
  // L'arrondissement existe bien : un acces hors perimetre est un refus
  // d'autorisation (403), pas une absence de ressource (404).
  if (!canAccessArrondissement(user, id)) forbidden();

  const [quartiers, statsReport] = await Promise.all([listQuartiers(user, id), getArrondissementStatsReport(user)]);
  const stats = statsReport.find((s) => s.id === id) ?? null;

  const columns: Column<QuartierRow>[] = [
    {
      key: "name",
      header: "Quartier",
      render: (q) => (
        <Link href={`/admin/quartiers/${q.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
          {q.name}
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (q) => (
        <span className="text-[var(--color-text-muted)]">
          {q.code}
          {q.sourceReference && (
            <span className="ms-1" title={q.sourceReference}>
              ⚠
            </span>
          )}
        </span>
      ),
    },
    { key: "sectors", header: "Secteurs", render: (q) => q._count.sectors },
    { key: "status", header: "Statut", render: (q) => <StatusBadge label={q.isActive ? "Actif" : "Inactif"} tone={q.isActive ? "success" : "neutral"} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (q) => can(user, "territorial", "edit") && <ToggleActiveButton endpoint={`/api/quartiers/${q.id}`} isActive={q.isActive} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/arrondissements" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Arrondissements
        </Link>
      </div>

      <PageHeading title={`${arrondissement.name} (${arrondissement.code})`} description={arrondissement.city.name} />

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.population !== null && <StatCard label="Population" value={stats.population.toLocaleString("fr-FR")} icon={<IconUsersGroup className="h-5 w-5" />} />}
          {stats.naissances !== null && <StatCard label="Naissances" value={stats.naissances} icon={<IconActivity className="h-5 w-5" />} tone="success" />}
          {stats.mariages !== null && <StatCard label="Mariages" value={stats.mariages} tone="gold" />}
          {stats.deces !== null && <StatCard label="Deces" value={stats.deces} tone="danger" />}
          {stats.recettes !== null && <StatCard label="Recettes" value={formatFcfa(stats.recettes)} icon={<IconCoins className="h-5 w-5" />} tone="warning" />}
          {stats.marches !== null && <StatCard label="Marches" value={stats.marches} icon={<IconBuildingOffice className="h-5 w-5" />} />}
          {stats.commerces !== null && <StatCard label="Commerces" value={stats.commerces} icon={<IconBuildingOffice className="h-5 w-5" />} />}
          {stats.demandes !== null && <StatCard label="Demandes" value={stats.demandes} icon={<IconClipboardList className="h-5 w-5" />} />}
          {stats.impayes !== null && <StatCard label="Obligations impayees" value={stats.impayes} tone="danger" />}
          {stats.menages !== null && <StatCard label="Menages" value={stats.menages} icon={<IconMapPin className="h-5 w-5" />} />}
        </div>
      )}

      {can(user, "territorial", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter un quartier</h2>
          <QuartierForm arrondissementId={id} />
        </div>
      )}

      <DataTable columns={columns} rows={quartiers} keyField="id" emptyLabel="Aucun quartier enregistre." />
    </div>
  );
}
