"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function UserForm({
  roles,
  arrondissements,
  departments,
  canCreateCentral,
}: {
  roles: Option[];
  arrondissements: Option[];
  departments: Option[];
  canCreateCentral: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [organizationLevel, setOrganizationLevel] = useState<"ARRONDISSEMENT" | "CENTRAL">("ARRONDISSEMENT");
  const [arrondissementIds, setArrondissementIds] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        roleIds,
        organizationLevel,
        departmentId: organizationLevel === "CENTRAL" ? departmentId || null : null,
        arrondissementIds: organizationLevel === "ARRONDISSEMENT" ? arrondissementIds : [],
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRoleIds([]);
    setArrondissementIds([]);
    setDepartmentId("");
    setOrganizationLevel("ARRONDISSEMENT");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
        style={{ background: "var(--color-primary)" }}
      >
        + Nouvel utilisateur
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom complet</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Mot de passe initial</label>
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">Niveau organisationnel</div>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="organizationLevel"
              checked={organizationLevel === "ARRONDISSEMENT"}
              onChange={() => setOrganizationLevel("ARRONDISSEMENT")}
            />
            Arrondissement
          </label>
          <label className={`flex items-center gap-1.5 text-sm ${!canCreateCentral ? "opacity-40" : ""}`}>
            <input
              type="radio"
              name="organizationLevel"
              disabled={!canCreateCentral}
              checked={organizationLevel === "CENTRAL"}
              onChange={() => setOrganizationLevel("CENTRAL")}
            />
            Mairie Centrale
          </label>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">Roles</div>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
              <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggle(roleIds, setRoleIds, r.id)} />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      {organizationLevel === "ARRONDISSEMENT" ? (
        <div>
          <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            Arrondissement(s) rattache(s) — au moins un requis
          </div>
          <div className="flex flex-wrap gap-2">
            {arrondissements.map((a) => (
              <label key={a.id} className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={arrondissementIds.includes(a.id)}
                  onChange={() => toggle(arrondissementIds, setArrondissementIds, a.id)}
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            Service central (optionnel)
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-64 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
          >
            <option value="">— Aucun —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creation..." : "Creer l'utilisateur"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
