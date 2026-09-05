import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getReconciliationBatch } from "@/lib/services/reconciliation";
import { ApiError } from "@/lib/api";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { ResolveReconciliationEntry } from "@/components/finances/resolve-reconciliation-entry";

function formatFcfa(amount: number | null) {
  if (amount == null) return "—";
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_LABEL: Record<string, string> = {
  MATCHED: "Reconcilie",
  AMOUNT_MISMATCH: "Ecart de montant",
  MISSING_INTERNAL: "Absent du releve",
  UNMATCHED_EXTERNAL: "Absent en interne",
};
const STATUS_TONE: Record<string, StatusTone> = {
  MATCHED: "success",
  AMOUNT_MISMATCH: "danger",
  MISSING_INTERNAL: "warning",
  UNMATCHED_EXTERNAL: "warning",
};

export default async function ReconciliationBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "reconciliation", "view")) redirect("/admin");

  let batch;
  try {
    batch = await getReconciliationBatch(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const discrepancyEntries = batch.entries.filter((e) => e.status !== "MATCHED");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reconciliation" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Rapprochements
        </Link>
      </div>

      <PageHeading
        title={`Rapprochement ${batch.provider}`}
        description={`${batch.fileName} — periode ${new Date(batch.periodStart).toLocaleDateString("fr-FR")} — ${new Date(batch.periodEnd).toLocaleDateString("fr-FR")}`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Reconcilies" value={batch.matchedCount} tone="success" />
        <StatCard label="Ecarts de montant" value={batch.mismatchCount} tone="danger" />
        <StatCard label="Absents du releve" value={batch.missingInternalCount} tone="warning" />
        <StatCard label="Absents en interne" value={batch.unmatchedExternalCount} tone="warning" />
      </div>

      <Card padding="p-0">
        <CardHeader title={`Ecarts a investiguer (${discrepancyEntries.length})`} />
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {discrepancyEntries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={STATUS_LABEL[entry.status] ?? entry.status} tone={STATUS_TONE[entry.status] ?? "neutral"} />
                  <span className="font-medium">{entry.externalReference ?? "—"}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Releve : {formatFcfa(entry.statementAmount)}
                  {entry.mobileMoneyTransaction && ` — Interne : ${formatFcfa(entry.mobileMoneyTransaction.amount)}`}
                </div>
                {entry.resolved && entry.resolutionNotes && (
                  <div className="mt-1 text-xs text-[var(--color-success)]">✓ {entry.resolutionNotes}</div>
                )}
              </div>
              {!entry.resolved && can(user, "reconciliation", "resolve") && <ResolveReconciliationEntry id={entry.id} />}
            </li>
          ))}
          {discrepancyEntries.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-[var(--color-text-muted)]">Aucun ecart — releve entierement reconcilie.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
