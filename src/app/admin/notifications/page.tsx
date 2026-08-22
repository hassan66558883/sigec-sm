import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listMyNotifications } from "@/lib/services/notifications";
import { MarkReadButton, MarkAllReadButton } from "@/components/notifications/mark-read-button";

const SEVERITY_CLASS: Record<string, string> = {
  INFO: "bg-gray-100 text-[var(--color-text-muted)]",
  WARNING: "bg-amber-100 text-[var(--color-warning)]",
  CRITICAL: "bg-red-100 text-[var(--color-danger)]",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await listMyNotifications(user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Notifications</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Alertes internes (section 32) — anomalies, ecarts de caisse, controles a traiter.
          </p>
        </div>
        {notifications.some((n) => !n.isRead) && <MarkAllReadButton />}
      </div>

      <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        {notifications.map((n) => (
          <div key={n.id} className={`flex items-start justify-between gap-4 px-5 py-4 ${n.isRead ? "" : "bg-[var(--color-bg)]"}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[n.severity] ?? ""}`}>{n.severity}</span>
                <span className="text-sm font-medium text-[var(--color-text)]">{n.title}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{n.message}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{new Date(n.createdAt).toLocaleString("fr-FR")}</span>
                {n.link && <Link href={n.link} className="text-[var(--color-primary)] hover:underline">Voir →</Link>}
              </div>
            </div>
            {!n.isRead && <MarkReadButton id={n.id} />}
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-[var(--color-text-muted)]">Aucune notification.</p>
        )}
      </div>
    </div>
  );
}
