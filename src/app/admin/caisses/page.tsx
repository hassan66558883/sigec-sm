import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listCashRegisters, listAgentsWithoutOpenCaisse } from "@/lib/services/caisses";
import { OpenCaisseForm } from "@/components/caisses/open-caisse-form";
import { CloseCaisseForm } from "@/components/caisses/close-caisse-form";

function formatFcfa(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

export default async function CaissesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "caisses", "view")) redirect("/admin");

  const [caisses, agents] = await Promise.all([
    listCashRegisters(user),
    can(user, "caisses", "create") ? listAgentsWithoutOpenCaisse(user) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Caisses agents</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Ouverture, collectes et rapprochement (section 20) — tout ecart a la cloture est signale automatiquement.
          </p>
        </div>
        {can(user, "caisses", "create") && <OpenCaisseForm agents={agents.map((a) => ({ id: a.id, label: `${a.user.name} (${a.matricule})` }))} />}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] bg-gray-50 text-left text-xs uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2.5">Numero</th>
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5">Ouverture</th>
              <th className="px-4 py-2.5">Collectes</th>
              <th className="px-4 py-2.5">Attendu</th>
              <th className="px-4 py-2.5">Declare</th>
              <th className="px-4 py-2.5">Ecart</th>
              <th className="px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {caisses.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">{c.number}</td>
                <td className="px-4 py-2.5">{c.agent.user.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{new Date(c.openedAt).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{c._count.payments}</td>
                <td className="px-4 py-2.5">{c.expectedAmount !== null ? formatFcfa(c.expectedAmount) : "—"}</td>
                <td className="px-4 py-2.5">{c.declaredAmount !== null ? formatFcfa(c.declaredAmount) : "—"}</td>
                <td className={`px-4 py-2.5 font-medium ${c.discrepancy && c.discrepancy !== 0 ? "text-[var(--color-danger)]" : ""}`}>
                  {c.discrepancy !== null ? formatFcfa(c.discrepancy) : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "OUVERTE" ? "bg-green-100 text-[var(--color-success)]" : "bg-gray-100 text-[var(--color-text-muted)]"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {c.status === "OUVERTE" && can(user, "caisses", "edit") && <CloseCaisseForm id={c.id} />}
                </td>
              </tr>
            ))}
            {caisses.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[var(--color-text-muted)]">Aucune caisse enregistree.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
