import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getBusiness } from "@/lib/services/businesses";
import { listQrCodesForEntity } from "@/lib/services/qr-codes";
import { ApiError } from "@/lib/api";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { QrPanel } from "@/components/finances/qr-panel";
import { TransferOwnershipPanel } from "@/components/finances/transfer-ownership-panel";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  FERMEE: "Ferme",
  SUSPENDUE: "Suspendu",
  EN_ATTENTE_DE_VALIDATION: "En attente",
};

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "businesses", "view")) redirect("/admin");

  let business;
  try {
    business = await getBusiness(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const qrCodes = can(user, "qr_codes", "view") ? await listQrCodesForEntity(user, "BUSINESS", id) : [];
  const activeQr = qrCodes.find((q) => q.status === "ACTIVE") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Boutiques &amp; commercants
        </Link>
      </div>

      <PageHeading
        title={business.name}
        description={business.code ?? "Aucun code d'emplacement"}
        action={<StatusBadge label={STATUS_LABEL[business.status] ?? business.status} tone={business.status === "ACTIVE" ? "success" : "neutral"} />}
      />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Proprietaire</div>
            <div className="text-sm">{business.owner.firstName} {business.owner.lastName}</div>
          </div>
          {can(user, "businesses", "transfer") && (
            <TransferOwnershipPanel businessId={business.id} currentOwnerName={`${business.owner.firstName} ${business.owner.lastName}`} />
          )}
        </div>
        <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Activite</div>
        <div className="text-sm">{business.activityRef?.name ?? business.activity ?? "—"}</div>
        <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Localisation</div>
        <div className="text-sm text-[var(--color-text-muted)]">
          {business.arrondissement.name}{business.quartier ? ` — ${business.quartier.name}` : ""}
        </div>
      </Card>

      {can(user, "qr_codes", "view") && (
        <QrPanel
          entityType="BUSINESS"
          entityId={business.id}
          canGenerate={can(user, "qr_codes", "generate")}
          canRevoke={can(user, "qr_codes", "revoke")}
          canReplace={can(user, "qr_codes", "replace")}
          activeQr={activeQr ? { id: activeQr.id, token: activeQr.token, issuedAt: activeQr.issuedAt.toISOString() } : null}
        />
      )}

      <Card padding="p-0">
        <CardHeader title="Factures (obligations)" />
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {business.obligations.map((o) => (
            <li key={o.id} className="px-5 py-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{o.number} ({o.period})</span>
                <span className="text-[var(--color-text-muted)]">{o.status}</span>
              </div>
            </li>
          ))}
          {business.obligations.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-[var(--color-text-muted)]">Aucune facture generee.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
