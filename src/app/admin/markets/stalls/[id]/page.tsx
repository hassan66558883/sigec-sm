import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getStall } from "@/lib/services/markets";
import { listQrCodesForEntity } from "@/lib/services/qr-codes";
import { ApiError } from "@/lib/api";
import { PageHeading } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { QrPanel } from "@/components/finances/qr-panel";

const STATUS_LABEL: Record<string, string> = { AVAILABLE: "Disponible", OCCUPIED: "Occupe", RESERVED: "Reserve", SUSPENDED: "Suspendu" };

export default async function StallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "markets", "view")) redirect("/admin");

  let stall;
  try {
    stall = await getStall(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const qrCodes = can(user, "qr_codes", "view") ? await listQrCodesForEntity(user, "MARKET_STALL", id) : [];
  const activeQr = qrCodes.find((q) => q.status === "ACTIVE") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/markets" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Marches municipaux
        </Link>
      </div>

      <PageHeading
        title={`Emplacement ${stall.code}`}
        description={stall.market.name}
        action={<StatusBadge label={STATUS_LABEL[stall.status] ?? stall.status} tone={stall.status === "OCCUPIED" ? "success" : "neutral"} />}
      />

      <Card>
        <div className="text-xs font-medium uppercase text-[var(--color-text-muted)]">Occupant</div>
        <div className="text-sm">{stall.occupant ? `${stall.occupant.firstName} ${stall.occupant.lastName}` : "Aucun occupant"}</div>
        <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Type</div>
        <div className="text-sm">{stall.type ?? "—"}</div>
        <div className="mt-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Localisation</div>
        <div className="text-sm text-[var(--color-text-muted)]">
          {stall.market.arrondissement.name}{stall.market.quartier ? ` — ${stall.market.quartier.name}` : ""}
        </div>
      </Card>

      {can(user, "qr_codes", "view") && (
        !stall.occupant ? (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">
              Un occupant doit d&apos;abord etre affecte a cet emplacement avant de generer un QR de paiement.
            </p>
          </Card>
        ) : (
          <QrPanel
            entityType="MARKET_STALL"
            entityId={stall.id}
            canGenerate={can(user, "qr_codes", "generate")}
            canRevoke={can(user, "qr_codes", "revoke")}
            canReplace={can(user, "qr_codes", "replace")}
            activeQr={activeQr ? { id: activeQr.id, token: activeQr.token, issuedAt: activeQr.issuedAt.toISOString() } : null}
          />
        )
      )}

      <Card padding="p-0">
        <CardHeader title="Factures (obligations)" />
        <ul className="divide-y divide-[var(--color-border-subtle)]">
          {stall.obligations.map((o) => (
            <li key={o.id} className="px-5 py-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{o.number} ({o.period})</span>
                <span className="text-[var(--color-text-muted)]">{o.status}</span>
              </div>
            </li>
          ))}
          {stall.obligations.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-[var(--color-text-muted)]">Aucune facture generee.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
