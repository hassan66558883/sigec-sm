import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listFraudAlerts } from "@/lib/services/fraud";
import { ResolveAlertForm } from "@/components/finances/resolve-alert-form";

const SEVERITY_CLASS: Record<string, string> = {
  LOW: "bg-gray-100 text-[var(--color-text-muted)]",
  MEDIUM: "bg-amber-100 text-[var(--color-warning)]",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-[var(--color-danger)]",
};

const TYPE_LABEL: Record<string, string> = {
  DOUBLE_PAYMENT: "Double paiement",
  DOUBLE_RECEIPT: "Double reçu",
  FORBIDDEN_MODIFICATION: "Modification interdite",
  EXCESSIVE_CANCELLATIONS: "Annulations excessives",
  CASH_DISCREPANCY: "Ecart de caisse",
  OUT_OF_ZONE: "Collecte hors zone",
  UNKNOWN_DEVICE: "Appareil inconnu",
  SUSPICIOUS_VOLUME: "Activite suspecte",
  OFF_HOURS: "Hors horaires",
  SUSPICIOUS_RECEIPT: "Reçu suspect",
};

export default async function FraudPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "fraud", "view")) redirect("/admin");
  const { status, severity } = await searchParams;

  const alerts = await listFraudAlerts(user, { status: status ?? "OUVERTE", severity });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Controle anti-fraude</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Alertes generees automatiquement (section 22) — jamais bloquantes, toujours journalisees et traitables.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <a href="/admin/fraud" className={`rounded-full px-3 py-1 font-medium ${(status ?? "OUVERTE") === "OUVERTE" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          Ouvertes
        </a>
        <a href="/admin/fraud?status=RESOLUE" className={`rounded-full px-3 py-1 font-medium ${status === "RESOLUE" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          Resolues
        </a>
        <a href="/admin/fraud?status=IGNOREE" className={`rounded-full px-3 py-1 font-medium ${status === "IGNOREE" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
          Ignorees
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Severite</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{new Date(a.createdAt).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-2.5">{TYPE_LABEL[a.type] ?? a.type}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[a.severity] ?? ""}`}>{a.severity}</span>
                </td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{a.description}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{a.agent?.user.name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {a.status === "OUVERTE" && can(user, "fraud", "resolve") && <ResolveAlertForm id={a.id} />}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucune alerte.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
