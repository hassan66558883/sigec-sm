"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SYSTEM_TYPES = [
  "GOVERNMENT", "BANK", "MOBILE_MONEY", "ERP", "POLICE", "JUSTICE", "HEALTH",
  "EDUCATION", "TAX", "TREASURY", "SMS", "EMAIL", "IDENTITY", "CADASTRE",
  "EXTERNAL_APPLICATION", "OTHER",
];

export function NewSystemForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("EXTERNAL_APPLICATION");
  const [environment, setEnvironment] = useState("DEVELOPMENT");
  const [authType, setAuthType] = useState("API_KEY");
  const [baseUrl, setBaseUrl] = useState("");
  const [organization, setOrganization] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/integration/systems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, code, type, environment, authType,
        baseUrl: baseUrl.trim() || null,
        organization: organization.trim() || null,
        contact: contact.trim() || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setName(""); setCode(""); setBaseUrl(""); setOrganization(""); setContact("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + Connect System
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">System Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">System Code</label>
          <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" placeholder="ORANGE_MONEY" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">System Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {SYSTEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Organization</label>
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Environment</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="DEVELOPMENT">DEVELOPMENT</option>
            <option value="STAGING">STAGING</option>
            <option value="PRODUCTION">PRODUCTION</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Authentication Type</label>
          <select value={authType} onChange={(e) => setAuthType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            <option value="API_KEY">API_KEY</option>
            <option value="OAUTH2">OAUTH2</option>
            <option value="NONE">NONE</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">API Base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" placeholder="https://api.example.td/v1" dir="ltr" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Contact</label>
          <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creating..." : "Connect System"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Cancel
        </button>
      </div>
    </form>
  );
}
