import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyComplaints } from "@/lib/services/complaints";
import { ComplaintForm } from "./complaint-form";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie", PROPRETE: "Proprete", ECLAIRAGE: "Eclairage", EAU: "Eau", SECURITE: "Securite", AUTRE: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau", RECEIVED: "Recu", ASSIGNED: "Affecte", IN_PROGRESS: "En traitement",
  PENDING: "En attente", RESOLVED: "Resolu", CLOSED: "Cloture",
};

export default async function MyComplaintsPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const complaints = await listMyComplaints(account);

  return (
    <div className="space-y-6">
      <PageHeading title="Mes plaintes" description="Deposez une plainte et suivez son traitement." />

      <Card>
        <ComplaintForm />
      </Card>

      <div className="space-y-3">
        {complaints.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">
                  {c.caseNumber} — {CATEGORY_LABEL[c.category]}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{c.description}</div>
              </div>
              <StatusBadge label={STATUS_LABEL[c.status]} tone="neutral" />
            </div>
            {c.updates.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-text-muted)]">
                {c.updates.map((u) => (
                  <li key={u.id}>
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")} — {STATUS_LABEL[u.status] ?? u.status}
                    {u.note ? ` : ${u.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {complaints.length === 0 && (
          <Card>
            <EmptyState title="Aucune plainte deposee." />
          </Card>
        )}
      </div>
    </div>
  );
}
