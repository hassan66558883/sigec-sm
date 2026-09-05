import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getComplaintForStaff } from "@/lib/services/complaints";
import { listUsers } from "@/lib/services/users";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ComplaintActions, COMPLAINT_STATUS_LABEL } from "@/components/municipal/complaint-actions";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie", PROPRETE: "Proprete", ECLAIRAGE: "Eclairage", EAU: "Eau", SECURITE: "Securite", AUTRE: "Autre",
};
const PRIORITY_LABEL: Record<string, string> = {
  FAIBLE: "Faible", NORMAL: "Normal", IMPORTANT: "Important", URGENT: "Urgent", CRITIQUE: "Critique",
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

  const [departments, users] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    listUsers(user),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/complaints" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Plaintes
        </Link>
      </div>

      <PageHeading
        title={complaint.caseNumber}
        description={`${CATEGORY_LABEL[complaint.category] ?? complaint.category} — ${PRIORITY_LABEL[complaint.priority] ?? complaint.priority}`}
        action={<StatusBadge label={COMPLAINT_STATUS_LABEL[complaint.status] ?? complaint.status} tone={complaint.status === "REJECTED" ? "danger" : complaint.status === "CLOSED" ? "success" : "warning"} />}
      />

      <Card>
        <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Citoyen</div>
        <div className="text-sm">{complaint.citizenAccount.citizen.firstName} {complaint.citizenAccount.citizen.lastName}</div>
        {complaint.title && (
          <>
            <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Objet</div>
            <div className="text-sm">{complaint.title}</div>
          </>
        )}
        <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Description</div>
        <div className="text-sm">{complaint.description}</div>
        {(complaint.address || complaint.landmark) && (
          <>
            <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Localisation</div>
            <div className="text-sm text-[var(--color-text-muted)]">{[complaint.address, complaint.landmark].filter(Boolean).join(" — ")}</div>
          </>
        )}
        {complaint.assignedDepartment && (
          <>
            <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Service</div>
            <div className="text-sm">{complaint.assignedDepartment.name}</div>
          </>
        )}
        {complaint.rejectionReason && (
          <>
            <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Motif de rejet</div>
            <div className="text-sm text-[var(--color-danger)]">{complaint.rejectionReason}</div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Faire avancer le dossier</h2>
        {can(user, "complaints", "update") ? (
          <ComplaintActions
            id={complaint.id}
            status={complaint.status}
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            agents={users.map((u) => ({ id: u.id, name: u.name }))}
            canAssign={can(user, "complaints", "assign")}
            canReject={can(user, "complaints", "reject")}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Vous n&apos;avez pas la permission de modifier ce dossier.</p>
        )}
      </Card>

      <Card padding="p-0">
        <CardHeader title="Historique" />
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {complaint.updates.map((u) => (
            <li key={u.id} className="px-5 py-3 text-sm">
              <div className="font-medium">{COMPLAINT_STATUS_LABEL[u.status] ?? u.status}</div>
              {u.note && <div className="text-[var(--color-text-muted)]">{u.note}</div>}
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(u.createdAt).toLocaleString("fr-FR")}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
