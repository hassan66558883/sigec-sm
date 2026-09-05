import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listWebhooks, WEBHOOK_EVENTS } from "@/lib/services/integration-webhooks";
import { listIntegrationSystems } from "@/lib/services/integration-systems";
import { NewWebhookForm } from "@/components/integration/new-webhook-form";
import { WebhookActions } from "@/components/integration/webhook-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import Link from "next/link";

const STATUS_TONE: Record<string, StatusTone> = { ACTIVE: "success", DISABLED: "neutral" };

type WebhookRow = Awaited<ReturnType<typeof listWebhooks>>[number];

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "webhooks_manage")) redirect("/admin/integration");

  const [webhooks, systems] = await Promise.all([listWebhooks(user), listIntegrationSystems(user)]);

  const columns: Column<WebhookRow>[] = [
    { key: "url", header: "Webhook URL", render: (w) => <span className="font-mono text-xs" dir="ltr">{w.url}</span> },
    { key: "event", header: "Event", render: (w) => w.event },
    { key: "system", header: "System", render: (w) => w.system?.name ?? "—" },
    { key: "status", header: "Status", render: (w) => <StatusBadge label={w.status} tone={STATUS_TONE[w.status] ?? "neutral"} /> },
    { key: "deliveries", header: "Deliveries", render: (w) => <Link href={`/admin/integration/webhooks/${w.id}`} className="text-[var(--color-primary)] hover:underline">{w._count.deliveries}</Link> },
    { key: "actions", header: "", align: "end", render: (w) => <WebhookActions id={w.id} status={w.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Webhooks"
        description="Notifie automatiquement les systemes externes sur un evenement metier (creation de citoyen, emission de document, paiement...)."
        action={<NewWebhookForm events={WEBHOOK_EVENTS} systems={systems.map((s) => ({ id: s.id, label: s.name }))} />}
      />
      <DataTable columns={columns} rows={webhooks} keyField="id" emptyLabel="Aucun webhook configure." pageSize={null} />
    </div>
  );
}
