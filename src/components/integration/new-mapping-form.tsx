"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Rule = { sourceField: string; targetField: string; transform: string; defaultValue: string; dateFormat: string };

const EMPTY_RULE: Rule = { sourceField: "", targetField: "", transform: "DIRECT", defaultValue: "", dateFormat: "" };

export function NewMappingForm({ targetFields, transforms }: { targetFields: readonly string[]; transforms: readonly string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rules, setRules] = useState<Rule[]>([{ ...EMPTY_RULE }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateRule(i: number, patch: Partial<Rule>) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/integration/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        entityType: "CITIZENS",
        rules: rules.map((r) => ({
          sourceField: r.sourceField,
          targetField: r.targetField,
          transform: r.transform,
          transformConfig:
            r.transform === "DEFAULT_VALUE" ? { defaultValue: r.defaultValue } : r.transform === "DATE_FORMAT" ? { format: r.dateFormat } : null,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de la creation.");
      return;
    }
    setName("");
    setRules([{ ...EMPTY_RULE }]);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
        + New Mapping
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Mapping Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-sm rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" placeholder="Import mensuel etat civil" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--color-text-muted)]">Rules (Entity: CITIZENS)</label>
        {rules.map((rule, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-[var(--color-border-subtle)] p-2 sm:grid-cols-5">
            <input required placeholder="Source column (CSV)" value={rule.sourceField} onChange={(e) => updateRule(i, { sourceField: e.target.value })} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" dir="ltr" />
            <select value={rule.targetField} onChange={(e) => updateRule(i, { targetField: e.target.value })} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
              <option value="">— target field —</option>
              {targetFields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={rule.transform} onChange={(e) => updateRule(i, { transform: e.target.value })} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
              {transforms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {rule.transform === "DEFAULT_VALUE" && (
              <input placeholder="Default value" value={rule.defaultValue} onChange={(e) => updateRule(i, { defaultValue: e.target.value })} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" />
            )}
            {rule.transform === "DATE_FORMAT" && (
              <input placeholder="DD/MM/YYYY" value={rule.dateFormat} onChange={(e) => updateRule(i, { dateFormat: e.target.value })} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs" dir="ltr" />
            )}
            <button type="button" onClick={() => setRules((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-[var(--color-danger)]">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setRules((prev) => [...prev, { ...EMPTY_RULE }])} className="text-xs font-medium text-[var(--color-primary)]">
          + Add rule
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {loading ? "Creating..." : "Create Mapping"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
          Cancel
        </button>
      </div>
    </form>
  );
}
