function cell(value: string | number): string {
  if (typeof value === "number") return String(value);
  // Stop spreadsheet apps from treating names as formulas.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV with a UTF-8 BOM so Excel detects the encoding. */
export function toCsv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
