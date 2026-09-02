import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyObligations } from "@/lib/services/online-payments";
import { PageHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { IconCoins, IconClipboardList, IconBell } from "@/components/icons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const APP_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  IN_REVIEW: "En traitement",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
  COMPLETED: "Terminee",
};
const APP_STATUS_TONE: Record<string, StatusTone> = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  APPROVED: "success",
  COMPLETED: "success",
  REJECTED: "danger",
};

export default async function PortailDashboardPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const [applications, notifications, obligations] = await Promise.all([
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
    listMyObligations(account),
  ]);

  const solde = obligations.reduce((sum, o) => sum + o.balance, 0);
  const factureEnAttente = obligations.filter((o) => o.balance > 0 && o.status !== "ANNULE").length;
  const factureEchue = obligations.filter((o) => o.status === "EN_RETARD").length;

  return (
    <div className="space-y-6">
      <PageHeading
        title={`Bonjour, ${account.citizen.firstName}`}
        description={`${account.citizen.uniqueNumber} — ${account.citizen.arrondissement.name}`}
        action={
          <Link href="/portail/demandes/nouvelle" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--gradient-primary)" }}>
            + Nouvelle demande
          </Link>
        }
      />

      <Link href="/portail/factures" className="block">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Solde a payer" value={formatFcfa(solde)} icon={<IconCoins className="h-5 w-5" />} tone={solde > 0 ? "warning" : "success"} />
          <StatCard label="Factures en attente" value={factureEnAttente} icon={<IconClipboardList className="h-5 w-5" />} />
          <StatCard label="Factures echues" value={factureEchue} tone={factureEchue > 0 ? "danger" : "success"} />
        </div>
      </Link>

      <Card padding="p-0">
        <CardHeader title="Mes demandes" />
        {applications.length === 0 ? (
          <EmptyState title="Aucune demande pour le moment." />
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium text-[var(--color-text)]">{a.applicationNumber}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{new Date(a.createdAt).toLocaleDateString("fr-FR")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge label={APP_STATUS_LABEL[a.status]} tone={APP_STATUS_TONE[a.status]} />
                  {a.resultCertificate && (
                    <Link href={`/verify/${a.resultCertificate.qrToken}`} target="_blank" className="text-xs text-[var(--color-primary)] hover:underline">
                      Voir le document →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="p-0">
        <CardHeader title="Notifications" icon={<IconBell className="h-4 w-4" />} />
        {notifications.length === 0 ? (
          <EmptyState title="Aucune notification." />
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {notifications.map((n) => (
              <li key={n.id} className="px-5 py-3 text-sm">
                <div className="font-medium text-[var(--color-text)]">{n.title}</div>
                <div className="text-[var(--color-text-muted)]">{n.message}</div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(n.createdAt).toLocaleString("fr-FR")}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
