"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus } from "./icons";

const CLIENT_TYPES = [
  { value: "MAIRIE", label: "Mairie" },
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "ADMINISTRATION", label: "Administration" },
  { value: "ONG", label: "ONG" },
  { value: "ASSOCIATION", label: "Association" },
  { value: "PARTICULIER", label: "Particulier" },
  { value: "AUTRE", label: "Autre" },
];

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] shadow-sm transition placeholder:text-[var(--color-text-muted)]/60 focus:border-[var(--tc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent-ring)]";
const labelClass = "mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]";

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
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className={labelClass}>Raison sociale</label>
        <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="ex: Ville de N'Djamena" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Nom commercial</label>
        <input value={commercialName} onChange={(e) => setCommercialName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Type</label>
        <select value={clientType} onChange={(e) => setClientType(e.target.value)} className={inputClass}>
          {CLIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Ville</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Telephone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Contact</label>
        <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputClass} />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          style={{ background: "linear-gradient(120deg, var(--tc-grad-from), var(--tc-grad-via))" }}
        >
          <IconPlus className="h-4 w-4" />
          {loading ? "Ajout..." : "Ajouter le client"}
        </button>
      </div>
      {error && <span className="text-xs text-[var(--color-danger)] sm:col-span-2 lg:col-span-3">{error}</span>}
    </form>
  );
}
