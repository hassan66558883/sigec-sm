import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getPopulationStats, getCivilStatusStats, getServicesStats } from "@/lib/services/analytics";

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

const CIVIL_STATUS_LABELS: Record<string, string> = {
  births: "Naissances",
  marriages: "Mariages",
  divorces: "Divorces",
  deaths: "Deces",
  recognitions: "Reconnaissances",
  certificates: "Certificats delivres",
};

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise", IN_REVIEW: "En traitement", APPROVED: "Approuvee", REJECTED: "Rejetee", COMPLETED: "Terminee",
};
const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  NEW: "Nouveau", RECEIVED: "Recu", ASSIGNED: "Affecte", IN_PROGRESS: "En traitement",
  PENDING: "En attente", RESOLVED: "Resolu", CLOSED: "Cloture",
};
const URBAN_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Soumise", UNDER_REVIEW: "En instruction", INSPECTED: "Controlee", APPROVED: "Approuvee", REJECTED: "Rejetee",
};
const PARCEL_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponible", OCCUPIED: "Occupee", DISPUTED: "Litige", TITLED: "Titree",
};

function BreakdownList({ rows, labels, title }: { rows: { status: string; count: number }[]; labels: Record<string, string>; title: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{title}</div>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.status} className="flex justify-between">
            <span>{labels[r.status] ?? r.status}</span>
            <span className="font-medium">{r.count}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-[var(--color-text-muted)]">Aucune donnee.</li>}
      </ul>
    </div>
  );
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canPopulation = can(user, "citizens", "view");
  const [population, civilStatus, services] = await Promise.all([
    canPopulation ? getPopulationStats(user) : null,
    getCivilStatusStats(user),
    getServicesStats(user),
  ]);

  const hasCivilStatusData = Object.values(civilStatus).some((v) => v !== null);
  const hasServicesData = Object.values(services).some((v) => v !== null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          Statistiques {user.hasGlobalScope ? "— Ville de N'Djamena" : ""}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Rapports consolides, calcules dynamiquement a partir des donnees reelles de votre perimetre.
        </p>
      </div>

      {population && (
        <Section title="Population">
          <StatCard label="Citoyens enregistres" value={population.total} />
          <StatCard label="Menages" value={population.households} />
          {population.bySex.map((r) => (
            <StatCard key={r.sex} label={r.sex === "M" ? "Hommes" : "Femmes"} value={r.count} />
          ))}
        </Section>
      )}

      {population && population.byMaritalStatus.length > 0 && (
        <BreakdownList
          title="Situation matrimoniale"
          rows={population.byMaritalStatus.map((r) => ({ status: r.status, count: r.count }))}
          labels={{ SINGLE: "Celibataire", MARRIED: "Marie(e)", DIVORCED: "Divorce(e)", WIDOWED: "Veuf/veuve" }}
        />
      )}

      {population && population.arrondissementBreakdown.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="border-b border-[var(--color-border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Population par arrondissement</h2>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {population.arrondissementBreakdown
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <li key={row.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>{row.name}</span>
                  <span className="font-medium">{row.count}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {hasCivilStatusData && (
        <Section title="Etat civil (total / cette annee)">
          {Object.entries(civilStatus).map(([key, value]) =>
            value ? (
              <StatCard key={key} label={CIVIL_STATUS_LABELS[key]} value={value.total} hint={`${value.thisYear} cette annee`} />
            ) : null,
          )}
        </Section>
      )}

      {hasServicesData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {services.applications && <BreakdownList title="Demandes citoyennes" rows={services.applications} labels={APPLICATION_STATUS_LABEL} />}
          {services.complaints && <BreakdownList title="Plaintes" rows={services.complaints} labels={COMPLAINT_STATUS_LABEL} />}
          {services.urbanCases && <BreakdownList title="Dossiers d'urbanisme" rows={services.urbanCases} labels={URBAN_STATUS_LABEL} />}
          {services.parcels && <BreakdownList title="Parcelles" rows={services.parcels} labels={PARCEL_STATUS_LABEL} />}
        </div>
      )}

      {!population && !hasCivilStatusData && !hasServicesData && (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)] shadow-sm">
          Aucune statistique disponible pour votre niveau de permission.
        </p>
      )}
    </div>
  );
}
