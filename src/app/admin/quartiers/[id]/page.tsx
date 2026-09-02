import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSectors } from "@/lib/services/territorial";
import { SectorForm } from "@/components/territorial/sector-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type SectorRow = Awaited<ReturnType<typeof listSectors>>[number];

export default async function QuartierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const quartier = await prisma.quartier.findUnique({ where: { id }, include: { arrondissement: true } });
  if (!quartier) notFound();

  const sectors = await listSectors(user, id);

  const columns: Column<SectorRow>[] = [
    { key: "name", header: "Secteur/Zone", render: (s) => s.name },
    { key: "code", header: "Code", render: (s) => <span className="text-[var(--color-text-muted)]">{s.code}</span> },
    { key: "status", header: "Statut", render: (s) => <StatusBadge label={s.isActive ? "Actif" : "Inactif"} tone={s.isActive ? "success" : "neutral"} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/arrondissements/${quartier.arrondissementId}`} className="text-xs text-[var(--color-primary)] hover:underline">
          ← {quartier.arrondissement.name}
        </Link>
      </div>

      <PageHeading
        title={`${quartier.name} (${quartier.code})`}
        description={quartier.sourceReference ? `⚠ ${quartier.sourceReference}` : undefined}
      />

      {can(user, "territorial", "create") && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Ajouter un secteur/zone</h2>
          <SectorForm quartierId={id} />
        </div>
      )}

      <DataTable columns={columns} rows={sectors} keyField="id" emptyLabel="Aucun secteur enregistre." />
    </div>
  );
}
