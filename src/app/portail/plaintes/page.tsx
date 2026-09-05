import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { prisma } from "@/lib/db";
import { listMyComplaints, listComplaintCategories, computeSlaStatus } from "@/lib/services/complaints";
import { ComplaintForm } from "./complaint-form";
import { SatisfactionForm } from "./satisfaction-form";
import { CommentThread } from "./comment-thread";
import { PageHeading } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { COMPLAINT_STATUS_LABEL } from "@/lib/complaint-labels";
import { AttachmentList } from "@/components/municipal/attachment-list";
import { AttachmentUploader } from "@/components/municipal/attachment-uploader";
import { ATTACHMENT_MAX_PER_COMPLAINT } from "@/lib/complaint-attachment-constants";

const CATEGORY_LABEL: Record<string, string> = {
  VOIRIE: "Voirie", PROPRETE: "Proprete", ECLAIRAGE: "Eclairage", EAU: "Eau", SECURITE: "Securite", AUTRE: "Autre",
};
const STATUS_TONE: Record<string, StatusTone> = {
  CLOSED: "success",
  REJECTED: "danger",
};
const SLA_LABEL: Record<string, string> = { ON_TIME: "Dans les delais", AT_RISK: "Attention", LATE: "En retard" };
const SLA_TONE: Record<string, StatusTone> = { ON_TIME: "success", AT_RISK: "warning", LATE: "danger" };

export default async function MyComplaintsPage() {
  const account = await getCurrentCitizenAccount();
  if (!account) return null;

  const [complaints, categories, quartiers] = await Promise.all([
    listMyComplaints(account),
    listComplaintCategories(),
    prisma.quartier.findMany({ where: { arrondissementId: account.citizen.arrondissementId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading title="Mes plaintes" description="Deposez une plainte et suivez son traitement." />

      <Card>
        <ComplaintForm
          categories={categories.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          quartiers={quartiers.map((q) => ({ id: q.id, name: q.name }))}
        />
      </Card>

      <div className="space-y-3">
        {complaints.map((c) => {
          const sla = c.dueAt ? computeSlaStatus(c.dueAt, c.resolvedAt, c.slaHours) : null;
          const canRate = (c.status === "CLOSED" || c.status === "RESOLVED") && !c.satisfaction;
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {c.caseNumber} — {c.title || CATEGORY_LABEL[c.category] || c.category}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">{c.description}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge label={COMPLAINT_STATUS_LABEL[c.status] ?? c.status} tone={STATUS_TONE[c.status] ?? "warning"} />
                  {sla && <StatusBadge label={SLA_LABEL[sla]} tone={SLA_TONE[sla]} dot={false} />}
                </div>
              </div>

              {c.updates.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-text-muted)]">
                  {c.updates.map((u) => (
                    <li key={u.id}>
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")} — {COMPLAINT_STATUS_LABEL[u.status] ?? u.status}
                      {u.note ? ` : ${u.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
                <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Pieces jointes</div>
                <AttachmentList
                  attachments={c.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes }))}
                  downloadBaseUrl={`/api/portal/complaints/${c.id}/attachments`}
                />
                {c.attachments.length < ATTACHMENT_MAX_PER_COMPLAINT && <AttachmentUploader uploadUrl={`/api/portal/complaints/${c.id}/attachments`} />}
              </div>

              <CommentThread complaintId={c.id} comments={c.comments.map((cm) => ({ id: cm.id, authorType: cm.authorType, message: cm.message, createdAt: cm.createdAt.toISOString() }))} />

              {canRate && <SatisfactionForm complaintId={c.id} />}
              {c.satisfaction && (
                <p className="mt-3 border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-text-muted)]">
                  Vous avez evalue ce dossier : {c.satisfaction.rating}/5 {"★".repeat(c.satisfaction.rating)}
                </p>
              )}
            </Card>
          );
        })}
        {complaints.length === 0 && (
          <Card>
            <EmptyState title="Aucune plainte deposee." />
          </Card>
        )}
      </div>
    </div>
  );
}
