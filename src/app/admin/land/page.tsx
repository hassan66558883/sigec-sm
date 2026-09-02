import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listParcels, listSubdivisions } from "@/lib/services/land";
import { listCitizens } from "@/lib/services/citizens";
import { prisma } from "@/lib/db";
import { ParcelForm } from "@/components/land/parcel-form";
import { SubdivisionForm } from "@/components/land/subdivision-form";
import { IssueTitleButton } from "@/components/land/issue-title-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<string, string> = { AVAILABLE: "Disponible", OCCUPIED: "Occupee", DISPUTED: "Litige", TITLED: "Titree" };
const STATUS_TONE: Record<string, StatusTone> = { AVAILABLE: "neutral", OCCUPIED: "warning", DISPUTED: "danger", TITLED: "success" };

type ParcelRow = Awaited<ReturnType<typeof listParcels>>[number];
type SubdivisionRow = Awaited<ReturnType<typeof listSubdivisions>>[number];

export default async function LandPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "land", "view")) redirect("/admin");

  const [parcels, subdivisions, arrondissements, citizens] = await Promise.all([
    listParcels(user),
    listSubdivisions(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    listCitizens(user),
  ]);

  const citizenOptions = citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }));

  const parcelColumns: Column<ParcelRow>[] = [
    { key: "parcelNumber", header: "Numero", render: (p) => <span className="text-xs text-[var(--color-text-muted)]">{p.parcelNumber}</span> },
    { key: "location", header: "Localisation", render: (p) => p.location || "—" },
    { key: "area", header: "Superficie", render: (p) => <span className="text-[var(--color-text-muted)]">{p.area ? `${p.area} m²` : "—"}</span> },
    { key: "owner", header: "Occupant", render: (p) => (p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : "—") },
    { key: "status", header: "Statut", render: (p) => <StatusBadge label={STATUS_LABEL[p.status]} tone={STATUS_TONE[p.status]} /> },
    {
      key: "title",
      header: "",
      align: "end",
      render: (p) =>
        p.title ? (
          <span className="text-xs text-[var(--color-text-muted)]">{p.title.titleNumber}</span>
        ) : (
          can(user, "land", "issue_title") && (
            <IssueTitleButton parcelId={p.id} citizens={p.owner ? [{ id: p.owner.id, label: `${p.owner.firstName} ${p.owner.lastName}` }] : citizenOptions} />
          )
        ),
    },
  ];

  const subdivisionColumns: Column<SubdivisionRow>[] = [
    { key: "name", header: "Projet", render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "zone", header: "Zone", render: (s) => <span className="text-[var(--color-text-muted)]">{s.zone || "—"}</span> },
    { key: "arrondissement", header: "Arrondissement", render: (s) => <span className="text-[var(--color-text-muted)]">{s.arrondissement.name}</span> },
    { key: "parcels", header: "Parcelles", render: (s) => s._count.parcels },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Foncier"
        description="Parcelles, lotissements et titres fonciers."
        action={
          can(user, "land", "create") && (
            <ParcelForm
              arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
              subdivisions={subdivisions.map((s) => ({ id: s.id, label: s.name }))}
              citizens={citizenOptions}
            />
          )
        }
      />

      <DataTable columns={parcelColumns} rows={parcels} keyField="id" emptyLabel="Aucune parcelle enregistree." />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Lotissements</h2>
          {can(user, "land", "create") && <SubdivisionForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />}
        </div>
        <DataTable columns={subdivisionColumns} rows={subdivisions} keyField="id" emptyLabel="Aucun lotissement enregistre." />
      </div>
    </div>
  );
}
