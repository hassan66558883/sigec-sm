import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listWebhookDeliveries } from "@/lib/services/integration-webhooks";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<string, StatusTone> = { PENDING: "neutral", DELIVERED: "success", RETRYING: "warning", FAILED: "danger" };

type DeliveryRow = Awaited<ReturnType<typeof listWebhookDeliveries>>[number];

export default async function WebhookDeliveriesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "webhooks_manage")) redirect("/admin/integration");

  const { id } = await params;
  const deliveries = await listWebhookDeliveries(user, id);

  const columns: Column<DeliveryRow>[] = [
    { key: "date", header: "Date", render: (d) => <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{new Date(d.createdAt).toLocaleString("fr-FR")}</span> },
    { key: "event", header: "Event", render: (d) => d.event },
    { key: "status", header: "Status", render: (d) => <StatusBadge label={d.status} tone={STATUS_TONE[d.status] ?? "neutral"} /> },
    { key: "attempts", header: "Attempts", render: (d) => d.attemptCount },
    { key: "responseStatus", header: "Response", render: (d) => d.responseStatus ?? "—" },
    { key: "nextRetry", header: "Next Retry", render: (d) => (d.nextRetryAt ? new Date(d.nextRetryAt).toLocaleString("fr-FR") : "—") },
    { key: "delivered", header: "Delivered At", render: (d) => (d.deliveredAt ? new Date(d.deliveredAt).toLocaleString("fr-FR") : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Webhook Deliveries" description="Historique des tentatives de livraison reelles pour ce webhook (succes, echec, retry en attente)." />
      <DataTable columns={columns} rows={deliveries} keyField="id" emptyLabel="Aucune livraison." pageSize={null} />
    </div>
  );
}
