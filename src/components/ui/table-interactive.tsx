"use client";

import { useMemo, useState, type ReactNode } from "react";

// Recoit des lignes DEJA rendues cote serveur (row.cells est du ReactNode,
// jamais une fonction) — seules les valeurs de tri (primitives serialisables)
// et le JSX deja resolu traversent la frontiere RSC/client, ce qui respecte
// exactement la meme contrainte que le reste de DataTable (voir data-table.tsx).
export type PreparedRow = {
  rowKey: string;
  cells: Record<string, ReactNode>;
  sortValues: Record<string, string | number>;
};

export type ColumnMeta = {
  key: string;
  header: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  sortable?: boolean;
};

const alignClass = (align?: "start" | "center" | "end") => (align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start");

export function TableInteractive({ columns, rows, pageSize }: { columns: ColumnMeta[]; rows: PreparedRow[]; pageSize?: number }) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a.sortValues[sortKey] ?? "";
      const bv = b.sortValues[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const effectivePageSize = pageSize ?? sorted.length;
  const totalPages = Math.max(1, Math.ceil(sorted.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-primary-light)]">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-dark)] ${alignClass(col.align)} ${col.className ?? ""}`}>
                  {col.sortable ? (
                    <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 transition hover:text-[var(--color-primary)]">
                      {col.header}
                      <span className="flex flex-col leading-[6px]">
                        <span className={`text-[8px] ${sortKey === col.key && sortDir === "asc" ? "text-[var(--color-primary)]" : "text-[var(--color-primary)]/30"}`}>▲</span>
                        <span className={`text-[8px] ${sortKey === col.key && sortDir === "desc" ? "text-[var(--color-primary)]" : "text-[var(--color-primary)]/30"}`}>▼</span>
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {pageRows.map((row) => (
              <tr key={row.rowKey} className="transition hover:bg-[var(--color-surface-hover)]">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-[var(--color-text)] ${alignClass(col.align)} ${col.className ?? ""}`}>
                    {row.cells[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && sorted.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
          <span>{sorted.length} resultat(s)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Precedent
            </button>
            <span className="font-medium text-[var(--color-text)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
