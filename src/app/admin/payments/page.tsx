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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Paiements & recettes</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Quittances emises. Vue consolidee : <Link href="/admin/finances" className="text-[var(--color-primary)] hover:underline">Tableau de bord des finances →</Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can(user, "payments", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a
              href="/api/payments/export"
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-gray-50"
            >
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
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Quittance</th>
              <th className="px-4 py-2.5">Payeur</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Origine</th>
              <th className="px-4 py-2.5">Montant</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{p.receiptNumber}</td>
                <td className="px-4 py-2.5">{p.payer.firstName} {p.payer.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{p.taxType?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{p.arrondissement?.name ?? "Mairie Centrale"}</td>
                <td className="px-4 py-2.5 font-medium">{p.amount.toLocaleString("fr-FR")} FCFA</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(p.paymentDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "PAID"
                        ? "bg-green-100 text-[var(--color-success)]"
                        : p.status === "ANNULE" || p.status === "ECHEC"
                          ? "bg-red-100 text-[var(--color-danger)]"
                          : p.status === "PENDING"
                            ? "bg-amber-100 text-[var(--color-warning)]"
                            : "bg-gray-100 text-[var(--color-text-muted)]"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "payments", "cancel") && p.status === "PAID" && (
                    <ReasonActionButton endpoint={`/api/payments/${p.id}`} action="cancel" label="Annuler" />
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Aucun paiement enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
