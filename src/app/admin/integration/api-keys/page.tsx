import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listApiKeys, AVAILABLE_SCOPES } from "@/lib/services/integration-api-keys";
import { listIntegrationSystems } from "@/lib/services/integration-systems";
import { NewApiKeyForm } from "@/components/integration/new-api-key-form";
import { ApiKeyActions } from "@/components/integration/api-key-actions";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<string, StatusTone> = { ACTIVE: "success", REVOKED: "danger", DISABLED: "neutral" };

type KeyRow = Awaited<ReturnType<typeof listApiKeys>>[number];

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "credentials")) redirect("/admin/integration");

  const [keys, systems] = await Promise.all([listApiKeys(user), listIntegrationSystems(user)]);

  const columns: Column<KeyRow>[] = [
    { key: "name", header: "Name", render: (k) => <span className="font-medium">{k.name}</span> },
    { key: "prefix", header: "Key", render: (k) => <span className="font-mono text-xs text-[var(--color-text-muted)]">{k.keyPrefix}…</span> },
    { key: "system", header: "System", render: (k) => k.system?.name ?? "—" },
    { key: "scopes", header: "Scopes", render: (k) => <span className="text-xs">{k.scopes.join(", ")}</span> },
    { key: "status", header: "Status", render: (k) => <StatusBadge label={k.status} tone={STATUS_TONE[k.status] ?? "neutral"} /> },
    { key: "lastUsed", header: "Last Used", render: (k) => (k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("fr-FR") : "Jamais") },
    { key: "expires", header: "Expires", render: (k) => (k.expiresAt ? new Date(k.expiresAt).toLocaleDateString("fr-FR") : "—") },
    { key: "actions", header: "", align: "end", render: (k) => <ApiKeyActions id={k.id} status={k.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Security & Credentials"
        description="Cles API pour l'authentification systeme-a-systeme. Le secret complet n'est jamais affiche apres sa creation."
        action={<NewApiKeyForm scopes={AVAILABLE_SCOPES} systems={systems.map((s) => ({ id: s.id, label: s.name }))} />}
      />
      <DataTable columns={columns} rows={keys} keyField="id" emptyLabel="Aucune cle API." pageSize={null} />
    </div>
  );
}
