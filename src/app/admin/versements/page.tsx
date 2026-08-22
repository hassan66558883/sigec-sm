import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listVersements } from "@/lib/services/versements";
import { listCaissesAwaitingVersement } from "@/lib/services/caisses";
import { VersementForm } from "@/components/caisses/versement-form";
import { ValidateVersementButtons } from "@/components/caisses/validate-versement-buttons";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

const STATUS_CLASS: Record<string, string> = {
  EN_ATTENTE: "bg-amber-100 text-[var(--color-warning)]",
  VALIDE: "bg-green-100 text-[var(--color-success)]",
  ECART: "bg-red-100 text-[var(--color-danger)]",
  REJETE: "bg-red-100 text-[var(--color-danger)]",
};

export default async function VersementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "versements", "view")) redirect("/admin");

  const [versements, caisses] = await Promise.all([
    listVersements(user),
    can(user, "versements", "create") ? listCaissesAwaitingVersement(user) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Versements</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Remise des especes collectees a la structure habilitee (section 21).
          </p>
        </div>
        {can(user, "versements", "create") && (
          <VersementForm
            caisses={caisses.map((c) => ({ id: c.id, label: `${c.number} — ${c.agent.user.name}`, expected: c.expectedAmount ?? 0 }))}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5">Attendu</th>
              <th className="px-4 py-2.5">Remis</th>
              <th className="px-4 py-2.5">Ecart</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {versements.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{v.number}</td>
                <td className="px-4 py-2.5">{v.agent.user.name}</td>
                <td className="px-4 py-2.5">{formatFcfa(v.expectedAmount)}</td>
                <td className="px-4 py-2.5">{formatFcfa(v.remittedAmount)}</td>
                <td className={`px-4 py-2.5 font-medium ${v.discrepancy !== 0 ? "text-[var(--color-danger)]" : ""}`}>{formatFcfa(v.discrepancy)}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[v.status] ?? ""}`}>{v.status}</span>
                </td>
                <td className="px-4 py-2.5">
                  {(v.status === "EN_ATTENTE" || v.status === "ECART") && can(user, "versements", "validate") && (
                    <ValidateVersementButtons id={v.id} />
                  )}
                </td>
              </tr>
            ))}
            {versements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucun versement enregistre.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
