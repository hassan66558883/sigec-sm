import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listDeathRecords, getDeathsPeriodStats } from "@/lib/services/deaths";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareDeathForm } from "@/components/civil-status/declare-death-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SearchBox } from "@/components/ui/search-box";
import { AdvancedSearchPanel } from "@/components/ui/advanced-search-panel";
import { IconActivity } from "@/components/icons";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declare", REGISTERED: "Enregistre" };
const STATUS_TONE: Record<string, StatusTone> = { DECLARED: "warning", REGISTERED: "success" };

type DeathRow = Awaited<ReturnType<typeof listDeathRecords>>[number];

export default async function DeathsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "deaths", "view")) redirect("/admin");
  const { search } = await searchParams;

  const [records, arrondissements, citizens, periodStats] = await Promise.all([
    listDeathRecords(user, search),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
    getDeathsPeriodStats(user),
  ]);

  const columns: Column<DeathRow>[] = [
    { key: "recordNumber", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.recordNumber}</span>, sortable: true, sortValue: (r) => r.recordNumber },
    { key: "deceased", header: "Defunt", render: (r) => <span className="font-medium">{r.deceased.firstName} {r.deceased.lastName}</span>, sortable: true, sortValue: (r) => `${r.deceased.lastName} ${r.deceased.firstName}` },
    { key: "date", header: "Date", render: (r) => <span className="text-[var(--color-text-muted)]">{new Date(r.dateOfDeath).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (r) => new Date(r.dateOfDeath).getTime() },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />, sortable: true, sortValue: (r) => STATUS_LABEL[r.status] },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === "DECLARED" && can(user, "deaths", "validate") && <ValidateButton endpoint={`/api/deaths/${r.id}`} />}
          {r.status === "REGISTERED" && can(user, "certificates", "create") && (
            <IssueCertificateButton sourceType="death" sourceId={r.id} label="Certificat" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Deces"
        description="Declaration et enregistrement des actes de deces."
        action={
          can(user, "deaths", "create") && (
            <DeclareDeathForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              citizens={citizens.filter((c) => !c.isDeceased).map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
            />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Aujourd'hui" value={periodStats.today} icon={<IconActivity className="h-5 w-5" />} />
        <StatCard label="Cette semaine" value={periodStats.week} icon={<IconActivity className="h-5 w-5" />} tone="gold" />
        <StatCard label="Ce mois" value={periodStats.month} icon={<IconActivity className="h-5 w-5" />} tone="success" />
        <StatCard label="Cette annee" value={periodStats.year} icon={<IconActivity className="h-5 w-5" />} tone="warning" />
      </div>

      <AdvancedSearchPanel action={search && <span className="text-xs text-[var(--color-text-muted)]">Filtre actif : &laquo;{search}&raquo;</span>}>
        <SearchBox defaultValue={search} placeholder="Rechercher par numero de dossier..." />
      </AdvancedSearchPanel>

      <DataTable columns={columns} rows={records} keyField="id" emptyLabel="Aucun acte de deces." />
    </div>
  );
}
