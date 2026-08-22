import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";

const APP_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  IN_REVIEW: "En traitement",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
  COMPLETED: "Terminee",
};
const APP_STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-[var(--color-warning)]",
  IN_REVIEW: "bg-amber-100 text-[var(--color-warning)]",
  APPROVED: "bg-green-100 text-[var(--color-success)]",
  COMPLETED: "bg-green-100 text-[var(--color-success)]",
  REJECTED: "bg-red-100 text-[var(--color-danger)]",
};

export default async function PortailDashboardPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const [applications, notifications] = await Promise.all([
    prisma.application.findMany({
      where: { citizenAccountId: account.id },
      include: { resultCertificate: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.findMany({
      where: { citizenAccountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            Bonjour, {account.citizen.firstName}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {account.citizen.uniqueNumber} — {account.citizen.arrondissement.name}
          </p>
        </div>
        <Link
          href="/portail/demandes/nouvelle"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          + Nouvelle demande
        </Link>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Mes demandes</h2>
        </div>
        {applications.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune demande pour le moment.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{a.applicationNumber}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${APP_STATUS_CLASS[a.status]}`}>
                    {APP_STATUS_LABEL[a.status]}
                  </span>
                  {a.resultCertificate && (
                    <Link
                      href={`/verify/${a.resultCertificate.qrToken}`}
                      target="_blank"
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Voir le document →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Notifications</h2>
        </div>
        {notifications.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Aucune notification.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {notifications.map((n) => (
              <li key={n.id} className="px-5 py-3 text-sm">
                <div className="font-medium">{n.title}</div>
                <div className="text-[var(--color-text-muted)]">{n.message}</div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {new Date(n.createdAt).toLocaleString("fr-FR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
