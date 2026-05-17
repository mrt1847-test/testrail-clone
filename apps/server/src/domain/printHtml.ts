import type { PrintDocument } from "./printDocument.js";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPrintDocumentHtml(doc: PrintDocument) {
  const metaRows = doc.meta
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value).replace(/\n/g, "<br />")}</td></tr>`
    )
    .join("");

  const tables = doc.tables
    .map((table) => {
      const head = table.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");
      const body = table.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell).replace(/\n/g, "<br />")}</td>`).join("")}</tr>`
        )
        .join("");
      return `<section class="print-table"><h2>${escapeHtml(table.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
    })
    .join("");

  const notes = (doc.notes ?? [])
    .map((note) => `<p class="print-note">${escapeHtml(note)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 24px; font-size: 12pt; }
    h1 { font-size: 20pt; margin: 0 0 4px; }
    .subtitle { color: #444; margin: 0 0 16px; }
    .generated { color: #666; font-size: 10pt; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; width: 28%; }
    .print-table h2 { font-size: 14pt; margin: 18px 0 8px; }
    .print-note { color: #555; font-size: 10pt; }
    @media print {
      body { margin: 12mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="generated">Generated ${escapeHtml(doc.generatedAt)}</p>
  <h1>${escapeHtml(doc.title)}</h1>
  ${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ""}
  ${metaRows ? `<table><tbody>${metaRows}</tbody></table>` : ""}
  ${tables}
  ${notes}
</body>
</html>`;
}
