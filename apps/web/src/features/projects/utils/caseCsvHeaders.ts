/** Client-side CSV header extraction (mirrors server import parser for UI only). */
export function extractCsvHeaders(input: string): string[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      break;
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (rows.length === 0) {
    row.push(field);
    rows.push(row);
  }

  return (rows[0] ?? []).map((cell) => cell.trim()).filter(Boolean);
}

export function buildCaseCsvTemplate(headers: string[], sampleRow?: Record<string, string>) {
  const escape = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const headerLine = headers.join(",");
  if (!sampleRow) return `${headerLine}\n`;
  const rowLine = headers.map((header) => escape(sampleRow[header] ?? "")).join(",");
  return `${headerLine}\n${rowLine}\n`;
}
