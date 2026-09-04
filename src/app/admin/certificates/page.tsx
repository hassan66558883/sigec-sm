import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listCertificatesPage, getCertificatesPeriodStats } from "@/lib/services/certificates";
import { RevokeButton } from "@/components/civil-status/revoke-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchBox } from "@/components/ui/search-box";
import { AdvancedSearchPanel } from "@/components/ui/advanced-search-panel";
import { IconActivity } from "@/components/icons";

type CertificateRow = Awaited<ReturnType<typeof listCertificatesPage>>["rows"][number];

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "certificates", "view")) redirect("/admin");
  const { search, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ rows: certificates, total, pageSize }, periodStats] = await Promise.all([
    listCertificatesPage(user, search, page),
    getCertificatesPeriodStats(user),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: Column<CertificateRow>[] = [
    { key: "documentNumber", header: "Numero", render: (c) => <span className="text-xs text-[var(--color-text-muted)]">{c.documentNumber}</span>, sortable: true, sortValue: (c) => c.documentNumber },
    { key: "type", header: "Type", render: (c) => c.certificateType.name, sortable: true, sortValue: (c) => c.certificateType.name },
    { key: "citizen", header: "Titulaire", render: (c) => (c.citizen ? `${c.citizen.firstName} ${c.citizen.lastName}` : "—"), sortable: true, sortValue: (c) => (c.citizen ? `${c.citizen.lastName} ${c.citizen.firstName}` : "") },
    { key: "issuedAt", header: "Delivre le", render: (c) => <span className="text-[var(--color-text-muted)]">{new Date(c.issuedAt).toLocaleDateString("fr-FR")}</span>, sortable: true, sortValue: (c) => new Date(c.issuedAt).getTime() },
    { key: "status", header: "Statut", render: (c) => <StatusBadge label={c.status === "VALID" ? "Valide" : "Revoque"} tone={c.status === "VALID" ? "success" : "danger"} />, sortable: true, sortValue: (c) => (c.status === "VALID" ? "Valide" : "Revoque") },
    {
      key: "verify",
      header: "Verification",
      render: (c) => (
        <Link href={`/verify/${c.qrToken}`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">
          Verifier →
        </Link>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (c) => c.status === "VALID" && can(user, "certificates", "revoke") && <RevokeButton endpoint={`/api/certificates/${c.id}`} label="Revoquer" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Certificats delivres" description="Documents officiels avec verification publique par QR code / lien." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Aujourd'hui" value={periodStats.today} icon={<IconActivity className="h-5 w-5" />} />
        <StatCard label="Cette semaine" value={periodStats.week} icon={<IconActivity className="h-5 w-5" />} tone="gold" />
        <StatCard label="Ce mois" value={periodStats.month} icon={<IconActivity className="h-5 w-5" />} tone="success" />
        <StatCard label="Cette annee" value={periodStats.year} icon={<IconActivity className="h-5 w-5" />} tone="warning" />
      </div>

      <AdvancedSearchPanel action={search && <span className="text-xs text-[var(--color-text-muted)]">Filtre actif : &laquo;{search}&raquo;</span>}>
        <SearchBox defaultValue={search} placeholder="Rechercher par numero de document..." />
      </AdvancedSearchPanel>

      <DataTable columns={columns} rows={certificates} keyField="id" emptyLabel="Aucun certificat delivre." pageSize={null} />
      <Pagination
        page={page}
        totalPages={totalPages}
        makeHref={(p) => `/admin/certificates?${new URLSearchParams({ ...(search ? { search } : {}), page: String(p) })}`}
      />
    </div>
  );
}
