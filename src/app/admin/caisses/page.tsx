import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listCashRegisters, listAgentsWithoutOpenCaisse } from "@/lib/services/caisses";
import { OpenCaisseForm } from "@/components/caisses/open-caisse-form";
import { CloseCaisseForm } from "@/components/caisses/close-caisse-form";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconCoins } from "@/components/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

type CaisseRow = Awaited<ReturnType<typeof listCashRegisters>>[number];

export default async function CaissesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "caisses", "view")) redirect("/admin");

  const [caisses, agents] = await Promise.all([
    listCashRegisters(user),
    can(user, "caisses", "create") ? listAgentsWithoutOpenCaisse(user) : Promise.resolve([]),
  ]);

  const open = caisses.filter((c) => c.status === "OUVERTE").length;
  const totalExpected = caisses.reduce((sum, c) => sum + (c.expectedAmount ?? 0), 0);
  const totalDeclared = caisses.reduce((sum, c) => sum + (c.declaredAmount ?? 0), 0);
  const withDiscrepancy = caisses.filter((c) => c.discrepancy !== null && c.discrepancy !== 0).length;

  const columns: Column<CaisseRow>[] = [
    { key: "number", header: "Numero", render: (c) => <span className="text-xs text-[var(--color-text-muted)]">{c.number}</span> },
    { key: "agent", header: "Agent", render: (c) => c.agent.user.name },
    { key: "opened", header: "Ouverture", render: (c) => <span className="text-[var(--color-text-muted)]">{new Date(c.openedAt).toLocaleString("fr-FR")}</span> },
    { key: "collections", header: "Collectes", render: (c) => <span className="text-[var(--color-text-muted)]">{c._count.payments}</span> },
    { key: "expected", header: "Attendu", render: (c) => (c.expectedAmount !== null ? formatFcfa(c.expectedAmount) : "—") },
    { key: "declared", header: "Declare", render: (c) => (c.declaredAmount !== null ? formatFcfa(c.declaredAmount) : "—") },
    {
      key: "discrepancy",
      header: "Ecart",
      render: (c) => <span className={`font-medium ${c.discrepancy && c.discrepancy !== 0 ? "text-[var(--color-danger)]" : ""}`}>{c.discrepancy !== null ? formatFcfa(c.discrepancy) : "—"}</span>,
    },
    { key: "status", header: "Statut", render: (c) => <StatusBadge label={c.status} tone={c.status === "OUVERTE" ? "success" : "neutral"} /> },
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

      {caisses.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Caisses ouvertes" value={open} icon={<IconCoins className="h-5 w-5" />} tone="success" />
          <StatCard label="Attendu (total)" value={formatFcfa(totalExpected)} tone="primary" />
          <StatCard label="Declare (total)" value={formatFcfa(totalDeclared)} tone="gold" />
          <StatCard label="Avec ecart" value={withDiscrepancy} tone="danger" />
        </div>
      )}

      <DataTable columns={columns} rows={caisses} keyField="id" emptyLabel="Aucune caisse enregistree." />
    </div>
  );
}
