import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getComplaintForStaff, computeSlaStatus, findSimilarComplaints } from "@/lib/services/complaints";
import { listUsers } from "@/lib/services/users";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ComplaintActions, COMPLAINT_STATUS_LABEL, DuplicateMergeButton } from "@/components/municipal/complaint-actions";
import { LocationMap } from "@/components/municipal/location-map-loader";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie", PROPRETE: "Proprete", ECLAIRAGE: "Eclairage", EAU: "Eau", SECURITE: "Securite", AUTRE: "Autre",
};
const PRIORITY_LABEL: Record<string, string> = {
  FAIBLE: "Faible", NORMAL: "Normal", IMPORTANT: "Important", URGENT: "Urgent", CRITIQUE: "Critique",
};
const SLA_LABEL: Record<string, string> = { ON_TIME: "Dans les delais", AT_RISK: "Attention", LATE: "En retard" };
const ESCALATION_LEVEL_LABEL: Record<string, string> = {
  AGENT: "Agent", SUPERVISOR: "Superviseur", DIRECTOR: "Directeur", CENTRAL_ADMIN: "Administration centrale",
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

  const [departments, users, similar] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    listUsers(user),
    can(user, "complaints", "assign") ? findSimilarComplaints(user, id) : Promise.resolve([]),
  ]);

  const sla = complaint.dueAt ? computeSlaStatus(complaint.dueAt, complaint.resolvedAt, complaint.slaHours) : null;

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
        action={
          <div className="flex items-center gap-2">
            {sla && <StatusBadge label={SLA_LABEL[sla]} tone={sla === "ON_TIME" ? "success" : sla === "AT_RISK" ? "warning" : "danger"} dot={false} />}
            <StatusBadge label={COMPLAINT_STATUS_LABEL[complaint.status] ?? complaint.status} tone={complaint.status === "REJECTED" ? "danger" : complaint.status === "CLOSED" ? "success" : "warning"} />
          </div>
        }
      />

      {complaint.mergedInto && (
        <Card>
          <p className="text-sm">
            Ce dossier a ete fusionne dans{" "}
            <Link href={`/admin/complaints/${complaint.mergedInto.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
              {complaint.mergedInto.caseNumber}
            </Link>.
          </p>
        </Card>
      )}

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
        {complaint.latitude != null && complaint.longitude != null && (
          <div className="mt-3">
            <LocationMap latitude={complaint.latitude} longitude={complaint.longitude} readOnly />
          </div>
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

      {complaint.escalations.length > 0 && (
        <Card padding="p-0">
          <CardHeader title="Escalades" />
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {complaint.escalations.map((esc) => (
              <li key={esc.id} className="px-5 py-3 text-sm">
                <div className="font-medium">
                  {ESCALATION_LEVEL_LABEL[esc.fromLevel] ?? esc.fromLevel} → {ESCALATION_LEVEL_LABEL[esc.toLevel] ?? esc.toLevel}
                </div>
                {esc.reason && <div className="text-[var(--color-text-muted)]">{esc.reason}</div>}
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(esc.createdAt).toLocaleString("fr-FR")}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {complaint.mergedFrom.length > 0 && (
        <Card padding="p-0">
          <CardHeader title="Dossiers fusionnes dans celui-ci" />
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {complaint.mergedFrom.map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <Link href={`/admin/complaints/${m.id}`} className="font-medium text-[var(--color-primary)] hover:underline">{m.caseNumber}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!complaint.mergedInto && similar.length > 0 && (
        <Card padding="p-0">
          <CardHeader title="Doublons potentiels" />
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {similar.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <Link href={`/admin/complaints/${s.id}`} className="font-medium text-[var(--color-primary)] hover:underline">{s.caseNumber}</Link>
                  <span className="ml-2 text-[var(--color-text-muted)]">
                    {s.citizenAccount.citizen.firstName} {s.citizenAccount.citizen.lastName} — {COMPLAINT_STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
                {can(user, "complaints", "assign") && (
                  <DuplicateMergeButton id={complaint.id} keepId={s.id} keepCaseNumber={s.caseNumber} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
