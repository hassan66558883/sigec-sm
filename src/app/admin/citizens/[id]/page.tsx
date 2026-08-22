import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getCitizen } from "@/lib/services/citizens";
import { ApiError } from "@/lib/api";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-0.5 text-sm text-[var(--color-text)]">{value ?? "—"}</div>
    </div>
  );
}

export default async function CitizenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "citizens", "view")) redirect("/admin");

  let citizen;
  try {
    citizen = await getCitizen(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/citizens" className="text-xs text-[var(--color-primary)] hover:underline">
          ← Citoyens
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">
          {citizen.firstName} {citizen.lastName}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{citizen.uniqueNumber}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:grid-cols-3">
        <Field label="Sexe" value={citizen.sex === "M" ? "Masculin" : "Feminin"} />
        <Field label="Date de naissance" value={citizen.dateOfBirth ? new Date(citizen.dateOfBirth).toLocaleDateString("fr-FR") : null} />
        <Field label="Lieu de naissance" value={citizen.placeOfBirth} />
        <Field label="Nationalite" value={citizen.nationality} />
        <Field label="Situation matrimoniale" value={citizen.maritalStatus} />
        <Field label="Statut" value={citizen.isDeceased ? "Decede" : "Vivant"} />
        <Field label="Telephone" value={citizen.phone} />
        <Field label="Adresse" value={citizen.address} />
        <Field label="Arrondissement" value={citizen.arrondissement.name} />
        <Field label="Quartier" value={citizen.quartier?.name} />
        <Field
          label="Pere"
          value={citizen.father ? `${citizen.father.firstName} ${citizen.father.lastName}` : null}
        />
        <Field
          label="Mere"
          value={citizen.mother ? `${citizen.mother.firstName} ${citizen.mother.lastName}` : null}
        />
      </div>

      {(citizen.childrenAsFather.length > 0 || citizen.childrenAsMother.length > 0) && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Enfants</h2>
          <ul className="space-y-1 text-sm">
            {[...citizen.childrenAsFather, ...citizen.childrenAsMother].map((child) => (
              <li key={child.id}>
                <Link href={`/admin/citizens/${child.id}`} className="text-[var(--color-primary)] hover:underline">
                  {child.firstName} {child.lastName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(citizen.marriagesAsHusband.length > 0 || citizen.marriagesAsWife.length > 0) && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Mariages</h2>
          <ul className="space-y-1 text-sm">
            {citizen.marriagesAsHusband.map((m) => (
              <li key={m.id}>
                Avec {m.wife.firstName} {m.wife.lastName} — {new Date(m.marriageDate).toLocaleDateString("fr-FR")} ({m.status})
              </li>
            ))}
            {citizen.marriagesAsWife.map((m) => (
              <li key={m.id}>
                Avec {m.husband.firstName} {m.husband.lastName} — {new Date(m.marriageDate).toLocaleDateString("fr-FR")} ({m.status})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
