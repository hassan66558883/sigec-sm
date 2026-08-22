import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { listMyComplaints } from "@/lib/services/complaints";
import { ComplaintForm } from "./complaint-form";

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
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Mes plaintes</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Deposez une plainte et suivez son traitement.</p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <ComplaintForm />
      </div>

      <div className="space-y-3">
        {complaints.map((c) => (
          <div key={c.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{c.caseNumber} — {CATEGORY_LABEL[c.category]}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{c.description}</div>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            {c.updates.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
                {c.updates.map((u) => (
                  <li key={u.id}>
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")} — {STATUS_LABEL[u.status] ?? u.status}
                    {u.note ? ` : ${u.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {complaints.length === 0 && (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
            Aucune plainte deposee.
          </p>
        )}
      </div>
    </div>
  );
}
