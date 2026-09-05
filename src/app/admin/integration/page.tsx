import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getIntegrationDashboardSummary } from "@/lib/services/integration-logs";
import { PageHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { IconPlug, IconActivity, IconShieldCheck, IconGauge } from "@/components/icons";

export default async function IntegrationDashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "integration", "view")) redirect("/admin");

  const summary = await getIntegrationDashboardSummary(user);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Integration Dashboard"
        description="Systemes externes connectes a SIGEC-SM via l'API Gateway — banques, mobile money, administrations, ERP."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Connected Systems" value={summary.connectedSystems} icon={<IconPlug />} tone="primary" href="/admin/integration/systems" />
        <StatCard label="API Calls Today" value={summary.callsToday} icon={<IconActivity />} tone="gold" href="/admin/integration/logs" />
        <StatCard label="Success Rate" value={`${summary.successRate}%`} icon={<IconShieldCheck />} tone={summary.successRate >= 95 ? "success" : "warning"} />
        <StatCard label="Failed Requests (today)" value={summary.failedToday} icon={<IconGauge />} tone={summary.failedToday > 0 ? "danger" : "success"} href="/admin/integration/logs" />
        <StatCard label="Systems Online" value={summary.systemsOnline} tone="success" href="/admin/integration/systems" />
        <StatCard label="Systems Offline" value={summary.systemsOffline} tone={summary.systemsOffline > 0 ? "danger" : "success"} href="/admin/integration/systems" />
        <StatCard label="Active API Keys" value={summary.activeApiKeys} tone="primary" href="/admin/integration/api-keys" />
        <StatCard label="Open Errors" value={summary.openErrors} tone={summary.openErrors > 0 ? "danger" : "success"} href="/admin/integration/errors" />
      </div>
    </div>
  );
}
