import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere } from "@/lib/rbac";
import { listPayments, listTaxTypes } from "@/lib/services/payments";
import { listBusinesses } from "@/lib/services/businesses";
import { listCitizens } from "@/lib/services/citizens";
import { PaymentForm } from "@/components/finances/payment-form";
import { ReasonActionButton } from "@/components/finances/reason-action-button";
import { PageHeading } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<string, StatusTone> = {
  PAID: "success",
  ANNULE: "danger",
  ECHEC: "danger",
  PENDING: "warning",
};

type PaymentRow = Awaited<ReturnType<typeof listPayments>>[number];

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "payments", "view")) redirect("/admin");

  const [payments, taxTypes, businesses, citizens, arrondissements] = await Promise.all([
    listPayments(user),
    listTaxTypes(),
    listBusinesses(user),
    listCitizens(user),
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
  ]);

  const columns: Column<PaymentRow>[] = [
    { key: "receiptNumber", header: "Quittance", render: (p) => <span className="text-xs text-[var(--color-text-muted)]">{p.receiptNumber}</span> },
    { key: "payer", header: "Payeur", render: (p) => <>{p.payer.firstName} {p.payer.lastName}</> },
    { key: "type", header: "Type", render: (p) => <span className="text-[var(--color-text-muted)]">{p.taxType?.name ?? "—"}</span> },
    { key: "origin", header: "Origine", render: (p) => <span className="text-[var(--color-text-muted)]">{p.arrondissement?.name ?? "Mairie Centrale"}</span> },
    { key: "amount", header: "Montant", render: (p) => <span className="font-medium">{p.amount.toLocaleString("fr-FR")} FCFA</span> },
    { key: "date", header: "Date", render: (p) => <span className="text-[var(--color-text-muted)]">{new Date(p.paymentDate).toLocaleDateString("fr-FR")}</span> },
    { key: "status", header: "Statut", render: (p) => <StatusBadge label={p.status} tone={STATUS_TONE[p.status] ?? "neutral"} /> },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (p) => can(user, "payments", "cancel") && p.status === "PAID" && <ReasonActionButton endpoint={`/api/payments/${p.id}`} action="cancel" label="Annuler" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Paiements & recettes"
        description={
          <>
            Quittances emises. Vue consolidee :{" "}
            <Link href="/admin/finances" className="text-[var(--color-primary)] hover:underline">
              Tableau de bord des finances →
            </Link>
          </>
        }
        action={
          <>
            {can(user, "payments", "export") && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
              <a href="/api/payments/export" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)]">
                Exporter (CSV)
              </a>
            )}
            {can(user, "payments", "create") && (
              <PaymentForm
                citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }))}
                taxTypes={taxTypes.map((t) => ({ id: t.id, label: t.name }))}
                businesses={businesses.map((b) => ({ id: b.id, label: b.name }))}
                arrondissements={arrondissements.map((a) => ({ id: a.id, label: a.name }))}
                canCollectCentral={user.hasGlobalScope}
              />
            )}
          </>
        }
      />

      <DataTable columns={columns} rows={payments} keyField="id" emptyLabel="Aucun paiement enregistre." />
    </div>
  );
}
