import type { PrintDocument } from "../api/printApi";

type PrintDocumentViewProps = {
  document: PrintDocument;
};

export function PrintDocumentView({ document }: PrintDocumentViewProps) {
  return (
    <article className="print-document mx-auto max-w-4xl px-6 py-8 text-slate-900">
      <p className="text-xs text-slate-500">Generated {new Date(document.generatedAt).toLocaleString()}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{document.title}</h1>
      {document.subtitle ? <p className="mt-1 text-sm text-slate-600">{document.subtitle}</p> : null}

      {document.meta.length > 0 ? (
        <table className="mt-6 w-full border-collapse text-sm">
          <tbody>
            {document.meta.map((row) => (
              <tr key={row.label} className="border-b border-slate-200">
                <th className="w-40 bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">{row.label}</th>
                <td className="px-3 py-2 whitespace-pre-wrap">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {document.tables.map((table) => (
        <section key={table.title} className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">{table.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  {table.columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-medium text-slate-600">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-slate-100">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 align-top whitespace-pre-wrap">
                        {cell || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {(document.notes ?? []).map((note) => (
        <p key={note} className="mt-4 text-xs text-slate-500">
          {note}
        </p>
      ))}
    </article>
  );
}
