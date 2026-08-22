"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Option = { id: string; label: string };
type Quartier = { id: string; name: string; arrondissementId: string };

export function CitizenForm({
  arrondissements,
  quartiers,
}: {
  arrondissements: Option[];
  quartiers: Quartier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("M");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [arrondissementId, setArrondissementId] = useState(arrondissements[0]?.id ?? "");
  const [quartierId, setQuartierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredQuartiers = useMemo(
    () => quartiers.filter((q) => q.arrondissementId === arrondissementId),
    [quartiers, arrondissementId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/citizens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        sex,
        dateOfBirth: dateOfBirth || undefined,
        placeOfBirth,
        phone,
        address,
        arrondissementId,
        quartierId: quartierId || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setPlaceOfBirth("");
    setPhone("");
    setAddress("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Nouveau citoyen
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Prenom</label>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom</label>
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Sexe</label>
          <select value={sex} onChange={(e) => setSex(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="M">Masculin</option>
            <option value="F">Feminin</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Date de naissance</label>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Lieu de naissance</label>
          <input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Telephone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Adresse</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Arrondissement</label>
          <select
            required
            value={arrondissementId}
            onChange={(e) => {
              setArrondissementId(e.target.value);
              setQuartierId("");
            }}
            className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
          >
            {arrondissements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Quartier</label>
          <select value={quartierId} onChange={(e) => setQuartierId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="">— Aucun —</option>
            {filteredQuartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creation..." : "Creer le citoyen"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
