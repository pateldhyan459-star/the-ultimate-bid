/** Whole credits, shown with Indian digit grouping, e.g. 1,00,000 cr. */
export function credits(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString('en-IN')} cr`;
}

/** Spreadsheet programs run cells that start with = + - @ as formulas. Neutralise them. */
export function csvCell(value: string | number | null | undefined): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
