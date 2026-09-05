"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Citizen = { id: string; firstName: string; lastName: string; uniqueNumber: string };

// Cession de propriete (module paiement QR, section 27). Recherche du
// nouveau proprietaire par nom/telephone/numero (meme endpoint que la
// collecte terrain, /api/citizens?search=) plutot qu'une longue liste
// deroulante — coherent avec le reste de l'admin pour ce genre de choix.
export function TransferOwnershipPanel({ businessId, currentOwnerName }: { businessId: string; currentOwnerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Citizen[]>([]);
  const [selected, setSelected] = useState<Citizen | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    const res = await fetch(`/api/citizens?search=${encodeURIComponent(search.trim())}`);
    const data = await res.json();
    setResults(res.ok ? data.data : []);
  }

  async function confirmTransfer() {
    if (!selected) return;
    if (!reason.trim()) {
      setError("Un motif est requis.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer_ownership", newOwnerId: selected.id, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la cession.");
      return;
    }
    setOpen(false);
    setSelected(null);
    setSearch("");
    setResults([]);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-hover)]"
      >
        Transferer la propriete
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-sm font-medium">Cession de propriete</div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Proprietaire actuel : <span className="font-medium text-[var(--color-text)]">{currentOwnerName}</span>. Les
        obligations/paiements deja emis restent attribues a lui ; seules les nouvelles factures viseront le nouveau
        proprietaire. Le QR actif reste valide (il identifie l&apos;emplacement, pas la personne).
      </p>

      {!selected ? (
        <>
          <form onSubmit={onSearch} className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, telephone ou numero du nouveau proprietaire..."
              className="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
            />
            <button type="submit" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-primary)]">
              Rechercher
            </button>
          </form>
          {results.length > 0 && (
            <div className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-hover)]"
                >
                  <div className="font-medium">{c.firstName} {c.lastName}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{c.uniqueNumber}</div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
            Nouveau proprietaire : <span className="font-medium">{selected.firstName} {selected.lastName}</span> ({selected.uniqueNumber})
          </div>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif de la cession (vente, succession, donation... obligatoire)..."
            className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
            rows={2}
          />
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirmTransfer}
              disabled={loading || !reason.trim()}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              style={{ background: "var(--color-primary)" }}
            >
              {loading ? "..." : "Confirmer la cession"}
            </button>
            <button onClick={() => setSelected(null)} className="text-xs text-[var(--color-text-muted)]">Changer</button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen(false)} className="block text-xs text-[var(--color-text-muted)]">Annuler</button>
    </div>
  );
}
