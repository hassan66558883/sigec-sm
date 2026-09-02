import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listMarriages, listMarriageRegimes, getMarriagesPeriodStats } from "@/lib/services/marriages";
import { listCitizens } from "@/lib/services/citizens";
import { DeclareMarriageForm } from "@/components/civil-status/declare-marriage-form";
import { ValidateButton } from "@/components/civil-status/validate-button";
import { IssueCertificateButton } from "@/components/civil-status/issue-certificate-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SearchBox } from "@/components/ui/search-box";
import { AdvancedSearchPanel } from "@/components/ui/advanced-search-panel";
import { IconActivity } from "@/components/icons";

const STATUS_LABEL: Record<string, string> = { DECLARED: "Declare", VALID: "Valide", DIVORCED: "Divorce", ANNULLED: "Annule" };
const STATUS_TONE: Record<string, StatusTone> = { DECLARED: "warning", VALID: "success", DIVORCED: "neutral", ANNULLED: "neutral" };

type MarriageRow = Awaited<ReturnType<typeof listMarriages>>[number];

export default async function MarriagesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "marriages", "view")) redirect("/admin");
  const { search } = await searchParams;

  const [records, arrondissements, citizens, regimes, periodStats] = await Promise.all([
    listMarriages(user, search),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
    listMarriageRegimes(),
    getMarriagesPeriodStats(user),
  ]);

  const columns: Column<MarriageRow>[] = [
    { key: "recordNumber", header: "Numero", render: (r) => <span className="text-xs text-[var(--color-text-muted)]">{r.recordNumber}</span>, sortable: true, sortValue: (r) => r.recordNumber },
    { key: "husband", header: "Epoux", render: (r) => <>{r.husband.firstName} {r.husband.lastName}</>, sortable: true, sortValue: (r) => `${r.husband.lastName} ${r.husband.firstName}` },
    { key: "wife", header: "Epouse", render: (r) => <>{r.wife.firstName} {r.wife.lastName}</>, sortable: true, sortValue: (r) => `${r.wife.lastName} ${r.wife.firstName}` },
    { key: "date", header: "Date", render: (r) => <span className="text-[var(--color-text-muted)]">{new Date(r.marriageDate).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (r) => new Date(r.marriageDate).getTime() },
    { key: "status", header: "Statut", render: (r) => <StatusBadge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />, sortable: true, sortValue: (r) => STATUS_LABEL[r.status] },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === "DECLARED" && can(user, "marriages", "validate") && <ValidateButton endpoint={`/api/marriages/${r.id}`} />}
          {r.status === "VALID" && can(user, "certificates", "create") && (
            <IssueCertificateButton sourceType="marriage" sourceId={r.id} label="Certificat" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Mariages"
        description="Dossiers de mariage et regimes matrimoniaux."
        action={
          can(user, "marriages", "create") && (
            <DeclareMarriageForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
              regimes={regimes.map((r) => ({ id: r.id, label: r.name }))}
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

      <DataTable columns={columns} rows={records} keyField="id" emptyLabel="Aucun dossier de mariage." />
    </div>
  );
}
