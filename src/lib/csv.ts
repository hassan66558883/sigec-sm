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

// Analyseur CSV minimal (RFC 4180), symetrique de toCsv() ci-dessus — gere
// les champs cites/echappes (guillemets doubles). Utilise pour ingerer un
// releve prestataire/banque televerse (module rapprochement, section 31) :
// premiere ligne = en-tetes, chaque ligne suivante devient un objet
// { [entete]: valeur }.
export function parseCsv(text: string): Record<string, string>[] {
  const rows = splitCsvRows(text.replace(/^﻿/, ""));
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((fields) => !(fields.length === 1 && fields[0] === ""))
    .map((fields) => {
      const row: Record<string, string> = {};
      header.forEach((h, i) => {
        row[h.trim()] = (fields[i] ?? "").trim();
      });
      return row;
    });
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
