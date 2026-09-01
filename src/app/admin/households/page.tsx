import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listHouseholds } from "@/lib/services/households";
import { HouseholdForm } from "@/components/civil-status/household-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";

type HouseholdRow = Awaited<ReturnType<typeof listHouseholds>>[number];

export default async function HouseholdsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "households", "view")) redirect("/admin");

  const [households, arrondissements] = await Promise.all([
    listHouseholds(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
  ]);

  const columns: Column<HouseholdRow>[] = [
    { key: "code", header: "Code", render: (h) => <span className="text-xs text-[var(--color-text-muted)]">{h.code}</span> },
    { key: "address", header: "Adresse", render: (h) => h.address || "—" },
    { key: "arrondissement", header: "Arrondissement", render: (h) => <span className="text-[var(--color-text-muted)]">{h.arrondissement.name}</span> },
    { key: "members", header: "Membres", render: (h) => h._count.members },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Menages"
        description="Unites de cohabitation rattachees a une adresse."
        action={can(user, "households", "create") && <HouseholdForm arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))} />}
      />

      <DataTable columns={columns} rows={households} keyField="id" emptyLabel="Aucun menage enregistre." />
    </div>
  );
}
