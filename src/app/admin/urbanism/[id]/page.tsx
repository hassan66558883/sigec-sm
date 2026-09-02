import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, canAccessArrondissement } from "@/lib/rbac";
import { CaseWorkflowActions } from "@/components/urbanism/case-workflow-actions";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";

const TYPE_LABEL: Record<string, string> = { BUILDING_PERMIT: "Permis de construire", DEMOLITION_PERMIT: "Autorisation de demolition" };
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise",
  UNDER_REVIEW: "En instruction",
  INSPECTED: "Controlee",
  APPROVED: "Approuvee",
  REJECTED: "Rejetee",
};

export default async function UrbanCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "urbanism", "view")) redirect("/admin");

  const record = await prisma.urbanPlanningCase.findUnique({
    where: { id },
    include: { parcel: true, applicant: true, arrondissement: true, certificates: true },
  });
  if (!record) notFound();
  if (!canAccessArrondissement(user, record.arrondissementId)) forbidden();

  const activeCertificate = record.certificates.find((c) => c.status === "VALID");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/urbanism" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Urbanisme
        </Link>
      </div>

      <PageHeading title={TYPE_LABEL[record.type]} description={`${record.caseNumber} — ${STATUS_LABEL[record.status]}`} />

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Demandeur</div>
            <div className="text-sm">{record.applicant.firstName} {record.applicant.lastName}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Parcelle</div>
            <div className="text-sm">{record.parcel.parcelNumber}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Arrondissement</div>
            <div className="text-sm">{record.arrondissement.name}</div>
          </div>
          <div className="sm:col-span-3">
            <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Description</div>
            <div className="text-sm">{record.description || "—"}</div>
          </div>
          {record.inspectionNotes && (
            <div className="sm:col-span-3">
              <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Notes de controle</div>
              <div className="text-sm">{record.inspectionNotes}</div>
            </div>
          )}
          {record.decisionNotes && (
            <div className="sm:col-span-3">
              <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Notes de decision</div>
              <div className="text-sm">{record.decisionNotes}</div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Instruction du dossier</h2>
        <CaseWorkflowActions id={record.id} status={record.status} canReview={can(user, "urbanism", "review")} canInspect={can(user, "urbanism", "inspect")} canDecide={can(user, "urbanism", "decide")} />
      </Card>

      {activeCertificate && (
        <Card padding="p-0">
          <CardHeader title="Document officiel" />
          <div className="space-y-1 p-5 text-sm">
            <div>Numero : {activeCertificate.documentNumber}</div>
            <Link href={`/verify/${activeCertificate.qrToken}`} target="_blank" className="text-[var(--color-primary)] hover:underline">
              Voir la page de verification publique →
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
