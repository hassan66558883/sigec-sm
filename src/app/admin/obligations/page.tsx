import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listObligations } from "@/lib/services/obligations";
import { listCitizens } from "@/lib/services/citizens";
import { listBusinesses } from "@/lib/services/businesses";
import { listMarkets } from "@/lib/services/markets";
import { listTariffs } from "@/lib/services/tariffs";
import { ObligationForm } from "@/components/obligations/obligation-form";
import { ReasonActionButton } from "@/components/finances/reason-action-button";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_LABEL: Record<string, string> = {
  A_PAYER: "A payer",
  PARTIELLEMENT_PAYE: "Partiellement paye",
  PAYE: "Paye",
  EN_RETARD: "En retard",
  ANNULE: "Annule",
};

export default async function ObligationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "obligations", "view")) redirect("/admin");
  const { status } = await searchParams;

  const [obligations, citizens, businesses, markets, tariffs] = await Promise.all([
    listObligations(user, { status }),
    listCitizens(user),
    listBusinesses(user),
    listMarkets(user),
    listTariffs(),
  ]);

  const stalls = markets.flatMap((m) => m.stalls.map((s) => ({ id: s.id, label: `${m.name} — ${s.code}` })));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Obligations de paiement</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Sommes dues generees a partir du referentiel tarifaire (section 11) — le solde n&apos;est jamais negatif.
          </p>
        </div>
        {can(user, "obligations", "create") && (
          <ObligationForm
            citizens={citizens.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.uniqueNumber})` }))}
            businesses={businesses.map((b) => ({ id: b.id, label: b.name }))}
            stalls={stalls}
            tariffs={tariffs.map((t) => ({ id: t.id, label: `${t.label} — ${formatFcfa(t.amount)}` }))}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {["", "A_PAYER", "PARTIELLEMENT_PAYE", "PAYE", "EN_RETARD", "ANNULE"].map((s) => (
          <a
            key={s || "all"}
            href={s ? `/admin/obligations?status=${s}` : "/admin/obligations"}
            className={`rounded-full px-3 py-1 font-medium ${
              (status ?? "") === s ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {s ? STATUS_LABEL[s] : "Toutes"}
          </a>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Contribuable</th>
              <th className="px-4 py-2.5">Periode</th>
              <th className="px-4 py-2.5">Montant</th>
              <th className="px-4 py-2.5">Solde</th>
              <th className="px-4 py-2.5">Echeance</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {obligations.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{o.number}</td>
                <td className="px-4 py-2.5">{o.citizen.firstName} {o.citizen.lastName}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{o.period}</td>
                <td className="px-4 py-2.5 font-medium">{formatFcfa(o.initialAmount)}</td>
                <td className={`px-4 py-2.5 font-medium ${o.balance > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>{formatFcfa(o.balance)}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{new Date(o.dueDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {can(user, "obligations", "cancel") && o.status !== "ANNULE" && o.paidAmount === 0 && (
                    <ReasonActionButton endpoint={`/api/obligations/${o.id}`} action="cancel" label="Annuler" />
                  )}
                </td>
              </tr>
            ))}
            {obligations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucune obligation enregistree.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
