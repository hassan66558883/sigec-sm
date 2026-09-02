import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getComplaintForStaff } from "@/lib/services/complaints";
import { ApiError } from "@/lib/api";
import { ComplaintActions } from "@/components/municipal/complaint-actions";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie", PROPRETE: "Proprete", ECLAIRAGE: "Eclairage", EAU: "Eau", SECURITE: "Securite", AUTRE: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau", RECEIVED: "Recu", ASSIGNED: "Affecte", IN_PROGRESS: "En traitement",
  PENDING: "En attente", RESOLVED: "Resolu", CLOSED: "Cloture",
};

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "complaints", "view")) redirect("/admin");

  let complaint;
  try {
    complaint = await getComplaintForStaff(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/complaints" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Plaintes
        </Link>
      </div>

      <PageHeading title={complaint.caseNumber} description={`${CATEGORY_LABEL[complaint.category]} — ${STATUS_LABEL[complaint.status]}`} />

      <Card>
        <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Citoyen</div>
        <div className="text-sm">{complaint.citizenAccount.citizen.firstName} {complaint.citizenAccount.citizen.lastName}</div>
        <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Description</div>
        <div className="text-sm">{complaint.description}</div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Faire avancer le dossier</h2>
        {can(user, "complaints", "update") ? (
          <ComplaintActions id={complaint.id} status={complaint.status} />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Vous n&apos;avez pas la permission de modifier ce dossier.</p>
        )}
      </Card>

      <Card padding="p-0">
        <CardHeader title="Historique" />
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {complaint.updates.map((u) => (
            <li key={u.id} className="px-5 py-3 text-sm">
              <div className="font-medium">{STATUS_LABEL[u.status] ?? u.status}</div>
              {u.note && <div className="text-[var(--color-text-muted)]">{u.note}</div>}
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(u.createdAt).toLocaleString("fr-FR")}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
