"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SatisfactionForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [wasResolved, setWasResolved] = useState("OUI");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/portal/complaints/${complaintId}/satisfaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wasResolved, rating, comment: comment.trim() || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'envoi.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <p className="text-xs text-[var(--color-success)]">Merci pour votre evaluation.</p>;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
      <p className="text-xs font-medium text-[var(--color-text)]">Votre probleme a-t-il ete correctement resolu ?</p>
      <div className="flex gap-2">
        {[
          { value: "OUI", label: "Oui" },
          { value: "PARTIEL", label: "Partiellement" },
          { value: "NON", label: "Non" },
        ].map((o) => (
          <button
            key={o.value}
            onClick={() => setWasResolved(o.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              wasResolved === o.value ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className="text-lg leading-none" aria-label={`${n} etoiles`}>
            <span style={{ color: n <= rating ? "var(--color-accent)" : "var(--color-border)" }}>★</span>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire (facultatif)..."
        rows={2}
        className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs"
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <button onClick={submit} disabled={loading} className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
        {loading ? "..." : "Envoyer mon evaluation"}
      </button>
    </div>
  );
}
