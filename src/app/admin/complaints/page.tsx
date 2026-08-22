import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listComplaintsForStaff } from "@/lib/services/complaints";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie",
  PROPRETE: "Proprete",
  ECLAIRAGE: "Eclairage",
  EAU: "Eau",
  SECURITE: "Securite",
  AUTRE: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau",
  RECEIVED: "Recu",
  ASSIGNED: "Affecte",
  IN_PROGRESS: "En traitement",
  PENDING: "En attente",
  RESOLVED: "Resolu",
  CLOSED: "Cloture",
};
const STATUS_CLASS: Record<string, string> = {
  NEW: "bg-amber-100 text-[var(--color-warning)]",
  RECEIVED: "bg-amber-100 text-[var(--color-warning)]",
  ASSIGNED: "bg-amber-100 text-[var(--color-warning)]",
  IN_PROGRESS: "bg-amber-100 text-[var(--color-warning)]",
  PENDING: "bg-gray-100 text-[var(--color-text-muted)]",
  RESOLVED: "bg-green-100 text-[var(--color-success)]",
  CLOSED: "bg-green-100 text-[var(--color-success)]",
};

export default async function ComplaintsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "complaints", "view")) redirect("/admin");

  const complaints = await listComplaintsForStaff(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Plaintes & doleances</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Guichet numerique — suivi des signalements citoyens.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Citoyen</th>
              <th className="px-4 py-2.5">Categorie</th>
              <th className="px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {complaints.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                  <Link href={`/admin/complaints/${c.id}`} className="text-[var(--color-primary)] hover:underline">
                    {c.caseNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{c.citizenAccount.citizen.firstName} {c.citizenAccount.citizen.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{CATEGORY_LABEL[c.category]}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucune plainte enregistree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
