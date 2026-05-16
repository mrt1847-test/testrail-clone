import { useMemo, useState } from "react";

import type { CaseImportIssue, CaseImportResult } from "../api/importExportApi";

type Props = {
  result: CaseImportResult | null;
};

function issueKey(issue: CaseImportIssue, index: number) {
  return `${issue.row}-${issue.field ?? ""}-${issue.code}-${index}`;
}

export function CaseImportValidationPanel({ result }: Props) {
  const [fieldFilter, setFieldFilter] = useState("");
  const issues = result?.issues ?? [];

  const fields = useMemo(() => {
    const unique = new Set<string>();
    for (const issue of issues) {
      if (issue.field) unique.add(issue.field);
    }
    return [...unique].sort();
  }, [issues]);

  const filtered = useMemo(() => {
    if (!fieldFilter) return issues;
    return issues.filter((issue) => issue.field === fieldFilter);
  }, [fieldFilter, issues]);

  if (!result) return null;

  const canCommit = result.summary.invalidRows === 0 && result.summary.validRows > 0;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-slate-900">
          Rows {result.summary.totalRows} · valid {result.summary.validRows} · invalid{" "}
          {result.summary.invalidRows}
          {result.summary.imported > 0 ? ` · imported ${result.summary.imported}` : ""}
        </p>
        {canCommit ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Ready to import</span>
        ) : (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Fix issues before import</span>
        )}
      </div>

      {issues.length === 0 ? (
        <p className="mt-2 text-xs text-emerald-700">No validation issues.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {fields.length > 0 ? (
            <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              Filter by field
              <select
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-800"
              >
                <option value="">All fields</option>
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="max-h-64 overflow-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Row</th>
                  <th className="px-2 py-1.5">Field</th>
                  <th className="px-2 py-1.5">Code</th>
                  <th className="px-2 py-1.5">Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((issue, index) => (
                  <tr key={issueKey(issue, index)} className="border-t border-slate-100 text-red-800">
                    <td className="px-2 py-1.5 font-mono">{issue.row}</td>
                    <td className="px-2 py-1.5 font-mono">{issue.field ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{issue.code}</td>
                    <td className="px-2 py-1.5 text-slate-800">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length < issues.length ? (
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {issues.length} issue(s).
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
