import Papa from "papaparse";

export function downloadCsv(
  rows: Array<Record<string, unknown>>,
  filename: string
): void {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function csvSafeFileName(base: string): string {
  return base.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-");
}
