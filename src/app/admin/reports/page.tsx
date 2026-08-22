import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, arrondissementScopeWhere, recordScopeWhere } from "@/lib/rbac";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "payments", "view")) redirect("/admin");

  const [arrondissements, agents] = await Promise.all([
    prisma.arrondissement.findMany({ where: arrondissementScopeWhere(user), orderBy: { number: "asc" } }),
    prisma.agentCollecteur.findMany({ where: recordScopeWhere(user), include: { user: true }, orderBy: { matricule: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Rapports</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Exports CSV filtres (section 31) — toujours bornes a votre perimetre territorial.
        </p>
      </div>

      {can(user, "payments", "export") && (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Rapport recettes</h2>
        <form method="get" action="/api/reports/payments" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Du</label>
            <input type="date" name="dateFrom" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Au</label>
            <input type="date" name="dateTo" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
          {user.hasGlobalScope && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Arrondissement</label>
              <select name="arrondissementId" defaultValue="" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
                <option value="">— Tous —</option>
                {arrondissements.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Agent</label>
            <select name="agentId" defaultValue="" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              <option value="">— Tous —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.user.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Mode de paiement</label>
            <select name="paymentMethod" defaultValue="" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              <option value="">— Tous —</option>
              <option value="ESPECES">Especes</option>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="VIREMENT">Virement</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Statut</label>
            <select name="status" defaultValue="" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              <option value="">— Tous —</option>
              <option value="PAID">Paye</option>
              <option value="PENDING">En attente</option>
              <option value="ANNULE">Annule</option>
              <option value="ECHEC">Echec</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
              Exporter (CSV)
            </button>
          </div>
        </form>
      </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {can(user, "obligations", "view") && (
          <a href="/api/reports/unpaid" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport impayes</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Toutes les obligations dont le solde reste ouvert.</div>
          </a>
        )}
        {can(user, "payments", "export") && (
          <a href="/api/reports/cancellations" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport annulations</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Paiements annules, motif et auteur.</div>
          </a>
        )}
        {can(user, "fraud", "view") && (
          <a href="/api/reports/fraud" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport anomalies</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Toutes les alertes du controle anti-fraude.</div>
          </a>
        )}
        {can(user, "mobile_money", "view") && (
          <a href="/api/reports/mobile-money" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport Mobile Money</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Toutes les transactions, quel que soit leur statut.</div>
          </a>
        )}
        {can(user, "receipts", "export") && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
          <a href="/api/receipts/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport reçus</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les reçus emis.</div>
          </a>
        )}
        {can(user, "audit", "export") && (
          <a href="/api/audit/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport audit</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Journal complet des actions sensibles.</div>
          </a>
        )}
        {can(user, "territorial", "export") && (
          <a href="/api/reports/arrondissements" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
            <div className="font-medium text-[var(--color-text)]">Rapport statistique par arrondissement</div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">Population, etat civil, recettes et impayes — une ligne par arrondissement.</div>
          </a>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Etat civil</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {can(user, "citizens", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a href="/api/citizens/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
              <div className="font-medium text-[var(--color-text)]">Rapport citoyens</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les citoyens recenses.</div>
            </a>
          )}
          {can(user, "households", "export") && (
            <a href="/api/households/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
              <div className="font-medium text-[var(--color-text)]">Rapport menages</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les menages enregistres.</div>
            </a>
          )}
          {can(user, "births", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a href="/api/births/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
              <div className="font-medium text-[var(--color-text)]">Rapport naissances</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les actes de naissance.</div>
            </a>
          )}
          {can(user, "marriages", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a href="/api/marriages/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
              <div className="font-medium text-[var(--color-text)]">Rapport mariages</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les actes de mariage.</div>
            </a>
          )}
          {can(user, "divorces", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a href="/api/divorces/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
              <div className="font-medium text-[var(--color-text)]">Rapport divorces</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les actes de divorce.</div>
            </a>
          )}
          {can(user, "deaths", "export") && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- telechargement de fichier (route API), pas une page a naviguer
            <a href="/api/deaths/export" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-sm hover:bg-gray-50">
              <div className="font-medium text-[var(--color-text)]">Rapport deces</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">Tous les actes de deces.</div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
