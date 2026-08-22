// Generateur CSV minimal (RFC 4180) reutilise par tous les exports (section
// "exports CSV/PDF/Excel" du cahier des charges — CSV couvre le besoin
// tabulaire ; PDF/Excel restent hors scope tant qu'aucun module ne l'exige
// specifiquement). Prefixe BOM UTF-8 pour un rendu correct sous Excel.
export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(String(c.value(row) ?? ""))).join(","),
  );
  return "﻿" + [header, ...lines].join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
