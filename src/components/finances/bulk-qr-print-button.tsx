"use client";

import { useState } from "react";

// Impression groupee de stickers QR (section 38) — POST + telechargement
// via blob (pas de <a href> simple possible : la requete est un POST avec
// un corps JSON). Genere un vrai PDF a chaque clic, jamais un placeholder :
// si le lot est vide ou hors perimetre, l'erreur reelle du serveur est
// affichee plutot qu'un succes simule.
export function BulkQrPrintButton({ entityType, entityIds, label }: { entityType: "BUSINESS" | "MARKET_STALL"; entityIds: string[]; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPrint() {
    if (entityIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/qr/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Echec de la generation.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-stickers-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Echec de la generation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={onPrint}
        disabled={loading || entityIds.length === 0}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
      >
        {loading ? "Generation..." : label}
      </button>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
