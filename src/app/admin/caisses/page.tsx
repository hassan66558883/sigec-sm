import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, recordScopeWhere } from "@/lib/rbac";
import { listCashRegistersPage, listAgentsWithoutOpenCaisse } from "@/lib/services/caisses";
import { OpenCaisseForm } from "@/components/caisses/open-caisse-form";
import { CloseCaisseForm } from "@/components/caisses/close-caisse-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconCoins } from "@/components/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

type CaisseRow = Awaited<ReturnType<typeof listCashRegistersPage>>["rows"][number];

export default async function CaissesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "caisses", "view")) redirect("/admin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const scopeWhere = recordScopeWhere(user);
  const [{ rows: caisses, total, pageSize }, agents, open, sums, withDiscrepancy] = await Promise.all([
    listCashRegistersPage(user, page),
    can(user, "caisses", "create") ? listAgentsWithoutOpenCaisse(user) : Promise.resolve([]),
    // Statistiques calculees sur l'ensemble du perimetre (pas seulement la
    // page courante) via des agregats dedies cote base — sinon, une fois la
    // pagination reelle en place, ces compteurs ne refleteraient plus que
    // les ~25 lignes de la page affichee (voir meme choix pour
    // totalCount/failureCount sur /admin/audit).
    prisma.cashRegister.count({ where: { ...scopeWhere, status: "OUVERTE" } }),
    prisma.cashRegister.aggregate({ where: scopeWhere, _sum: { expectedAmount: true, declaredAmount: true } }),
    prisma.cashRegister.count({ where: { ...scopeWhere, discrepancy: { not: 0 } } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const totalExpected = sums._sum.expectedAmount ?? 0;
  const totalDeclared = sums._sum.declaredAmount ?? 0;

  const columns: Column<CaisseRow>[] = [
    { key: "number", header: "Numero", render: (c) => <span className="text-xs text-[var(--color-text-muted)]">{c.number}</span>, sortable: true, sortValue: (c) => c.number },
    { key: "agent", header: "Agent", render: (c) => c.agent.user.name, sortable: true, sortValue: (c) => c.agent.user.name },
    { key: "opened", header: "Ouverture", render: (c) => <span className="text-[var(--color-text-muted)]">{new Date(c.openedAt).toLocaleString("fr-FR")}</span>, sortable: true, sortValue: (c) => new Date(c.openedAt).getTime() },
    { key: "collections", header: "Collectes", render: (c) => <span className="text-[var(--color-text-muted)]">{c._count.payments}</span>, sortable: true, sortValue: (c) => c._count.payments },
    { key: "expected", header: "Attendu", render: (c) => (c.expectedAmount !== null ? formatFcfa(c.expectedAmount) : "—"), sortable: true, sortValue: (c) => c.expectedAmount ?? 0 },
    { key: "declared", header: "Declare", render: (c) => (c.declaredAmount !== null ? formatFcfa(c.declaredAmount) : "—"), sortable: true, sortValue: (c) => c.declaredAmount ?? 0 },
    {
      key: "discrepancy",
      header: "Ecart",
      render: (c) => <span className={`font-medium ${c.discrepancy && c.discrepancy !== 0 ? "text-[var(--color-danger)]" : ""}`}>{c.discrepancy !== null ? formatFcfa(c.discrepancy) : "—"}</span>,
      sortable: true,
      sortValue: (c) => c.discrepancy ?? 0,
    },
    { key: "status", header: "Statut", render: (c) => <StatusBadge label={c.status} tone={c.status === "OUVERTE" ? "success" : "neutral"} />, sortable: true, sortValue: (c) => c.status },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (c) => c.status === "OUVERTE" && can(user, "caisses", "edit") && <CloseCaisseForm id={c.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Caisses agents"
        description="Ouverture, collectes et rapprochement — tout ecart a la cloture est signale automatiquement."
        action={can(user, "caisses", "create") && <OpenCaisseForm agents={agents.map((a) => ({ id: a.id, label: `${a.user.name} (${a.matricule})` }))} />}
      />

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Caisses ouvertes" value={open} icon={<IconCoins className="h-5 w-5" />} tone="success" />
          <StatCard label="Attendu (total)" value={formatFcfa(totalExpected)} tone="primary" />
          <StatCard label="Declare (total)" value={formatFcfa(totalDeclared)} tone="gold" />
          <StatCard label="Avec ecart" value={withDiscrepancy} tone="danger" />
        </div>
      )}

      <DataTable columns={columns} rows={caisses} keyField="id" emptyLabel="Aucune caisse enregistree." pageSize={null} />
      <Pagination page={page} totalPages={totalPages} makeHref={(p) => `/admin/caisses?${new URLSearchParams({ page: String(p) })}`} />
    </div>
  );
}
