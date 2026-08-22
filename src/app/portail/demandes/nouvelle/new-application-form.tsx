"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; label: string };

export function NewApplicationForm({ birthRecordId, marriages }: { birthRecordId: string | null; marriages: Option[] }) {
  const router = useRouter();
  const [type, setType] = useState<"BIRTH_CERTIFICATE_COPY" | "MARRIAGE_CERTIFICATE_COPY">(
    birthRecordId ? "BIRTH_CERTIFICATE_COPY" : "MARRIAGE_CERTIFICATE_COPY",
  );
  const [marriageId, setMarriageId] = useState(marriages[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/portal/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        birthRecordId: type === "BIRTH_CERTIFICATE_COPY" ? birthRecordId : undefined,
        marriageId: type === "MARRIAGE_CERTIFICATE_COPY" ? marriageId : undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'envoi de la demande.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/portail"), 1200);
  }

  if (!birthRecordId && marriages.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Aucun acte enregistre a votre nom ne permet une demande de copie pour le moment.
      </p>
    );
  }

  if (done) {
    return <p className="text-sm text-[var(--color-success)]">Demande envoyee. Redirection...</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type de document</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          {birthRecordId && <option value="BIRTH_CERTIFICATE_COPY">Copie de mon acte de naissance</option>}
          {marriages.length > 0 && <option value="MARRIAGE_CERTIFICATE_COPY">Copie de mon acte de mariage</option>}
        </select>
      </div>

      {type === "MARRIAGE_CERTIFICATE_COPY" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Mariage concerne</label>
          <select value={marriageId} onChange={(e) => setMarriageId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {marriages.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {loading ? "Envoi..." : "Envoyer la demande"}
      </button>
    </form>
  );
}
