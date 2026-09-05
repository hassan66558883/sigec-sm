"use client";

import { useRef, useState } from "react";

type MappingOption = { id: string; label: string };
type RowDiagnostic = { row: number; data: Record<string, string>; errors: string[]; warnings: string[] };
type PreviewResult = { jobId: string; totalRows: number; validRows: number; invalidRows: number; preview: RowDiagnostic[] };
type CommitResult = { status: string; importedRows: number; errors: string | null };

export function ImportWizard({ mappings }: { mappings: MappingOption[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mappingId, setMappingId] = useState(mappings[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setCommitResult(null);
    const reader = new FileReader();
    reader.onload = () => setCsvContent(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function onPreview() {
    if (!csvContent || !fileName || !mappingId) return;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/integration/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappingId, csvContent, fileName }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de l'analyse.");
      return;
    }
    setPreview(data.data);
  }

  async function onCommit() {
    if (!preview) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/integration/import/${preview.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec de l'import.");
      return;
    }
    setCommitResult(data.data);
  }

  if (mappings.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Aucun mapping disponible — creez-en un depuis Data Mapping avant de lancer un import.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">1. Select mapping</label>
          <select value={mappingId} onChange={(e) => setMappingId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
            {mappings.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">2. Upload CSV file</label>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <button
        onClick={onPreview}
        disabled={loading || !csvContent}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {loading && !preview ? "Analyzing..." : "3-6. Detect, Map, Validate, Preview"}
      </button>

      {preview && !commitResult && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
          <p className="text-sm font-medium">
            {preview.totalRows} lignes analysees — <span className="text-[var(--color-success)]">{preview.validRows} valides</span>,{" "}
            <span className="text-[var(--color-danger)]">{preview.invalidRows} invalides</span>
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]">
                  <th className="pr-3">Row</th>
                  <th className="pr-3">Data</th>
                  <th className="pr-3">Errors</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((d) => (
                  <tr key={d.row} className={d.errors.length > 0 ? "text-[var(--color-danger)]" : ""}>
                    <td className="pr-3 align-top">{d.row}</td>
                    <td className="pr-3 align-top font-mono" dir="ltr">{JSON.stringify(d.data)}</td>
                    <td className="pr-3 align-top">{d.errors.join("; ")}</td>
                    <td className="align-top text-[var(--color-warning-text)]">{d.warnings.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.totalRows > preview.preview.length && (
            <p className="text-xs text-[var(--color-text-muted)]">Apercu limite aux {preview.preview.length} premieres lignes sur {preview.totalRows}.</p>
          )}
          <button
            onClick={onCommit}
            disabled={loading || preview.validRows === 0}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-success)" }}
          >
            {loading ? "Importing..." : `7. Import ${preview.validRows} valid row(s)`}
          </button>
        </div>
      )}

      {commitResult && (
        <div className="rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 p-4">
          <p className="text-sm font-medium text-[var(--color-text)]">8. Results</p>
          <p className="mt-1 text-sm">Statut : {commitResult.status} — {commitResult.importedRows} enregistrement(s) reellement cree(s).</p>
          {commitResult.errors && <p className="mt-1 text-xs text-[var(--color-danger)]">Erreurs : {commitResult.errors}</p>}
        </div>
      )}
    </div>
  );
}
