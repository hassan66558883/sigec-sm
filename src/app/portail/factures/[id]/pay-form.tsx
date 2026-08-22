"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PayForm({ obligationId, defaultPhone }: { obligationId: string; defaultPhone: string | null }) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/portal/obligations/${obligationId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerCode: "MANUAL", phoneNumber }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'initialisation du paiement.");
      return;
    }
    setPending(true);
    router.refresh();
  }

  if (pending) {
    return (
      <p className="rounded-md border border-[var(--color-border)] bg-gray-50 p-3 text-sm text-[var(--color-text-muted)]">
        Paiement initie. Il sera confirme des reception effective par le prestataire — votre reçu sera disponible
        automatiquement dans &quot;Mes paiements&quot; une fois la confirmation recue.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Numero Mobile Money</label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+235..."
          className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {loading ? "Initialisation..." : "Payer"}
      </button>
    </form>
  );
}
