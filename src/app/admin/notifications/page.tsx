import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listMyNotifications } from "@/lib/services/notifications";
import { MarkReadButton, MarkAllReadButton } from "@/components/notifications/mark-read-button";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { IconBell } from "@/components/icons";

const SEVERITY_TONE: Record<string, StatusTone> = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "danger",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await listMyNotifications(user);
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Notifications"
        description="Alertes internes — anomalies, ecarts de caisse, controles a traiter."
        action={unread > 0 && <MarkAllReadButton />}
      />

      {notifications.length === 0 ? (
        <Card>
          <EmptyState icon={<IconBell className="h-5 w-5" />} title="Aucune notification." />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {notifications.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-4 px-5 py-4 transition ${n.isRead ? "" : "bg-[var(--color-primary-light)]/40"}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge label={n.severity} tone={SEVERITY_TONE[n.severity] ?? "neutral"} />
                    <span className="text-sm font-medium text-[var(--color-text)]">{n.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{n.message}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>{new Date(n.createdAt).toLocaleString("fr-FR")}</span>
                    {n.link && (
                      <Link href={n.link} className="text-[var(--color-primary)] hover:underline">
                        Voir →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.isRead && <MarkReadButton id={n.id} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
