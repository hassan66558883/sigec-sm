"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CLIENT_TYPES = [
  { value: "MAIRIE", label: "Mairie" },
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "ADMINISTRATION", label: "Administration" },
  { value: "ONG", label: "ONG" },
  { value: "ASSOCIATION", label: "Association" },
  { value: "PARTICULIER", label: "Particulier" },
  { value: "AUTRE", label: "Autre" },
];

export function TechnoClientForm() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [clientType, setClientType] = useState("ENTREPRISE");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/technotchad/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalName, commercialName, clientType, city, phone, email, contactPerson }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setLegalName("");
    setCommercialName("");
    setCity("");
    setPhone("");
    setEmail("");
    setContactPerson("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Raison sociale</label>
        <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="ex: Ville de N'Djamena" className="w-56 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Nom commercial</label>
        <input value={commercialName} onChange={(e) => setCommercialName(e.target.value)} className="w-48 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type</label>
        <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
          {CLIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Ville</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className="w-32 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Telephone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-36 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-48 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Contact</label>
        <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-40 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "Ajout..." : "Ajouter"}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </form>
  );
}
