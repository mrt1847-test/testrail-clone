import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { apiFetch } from "../../../../shared/api/http";
import type { Ok } from "../../../../shared/api/types";
import { reportKeys } from "../../hooks/reportKeys";
import { ReportPageHeader, ReportSummaryStrip, ReportTablePanel } from "./ReportChrome";

type Row = {
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
  caseId: string;
  caseTitle: string;
  runId: string | null;
  runName: string | null;
  testId: string | null;
  latestStatus: string;
  defects: string[];
};

export function ReportTraceabilityPage() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: reportKeys.traceability(projectId),
    queryFn: async (): Promise<Row[]> => {
      const res = await apiFetch<Ok<{ items: Row[] }>>(`/api/projects/${projectId}/reports/traceability`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const summaryItems = useMemo(() => {
    if (rows.length === 0) return [];
    const reqIds = new Set(rows.map((r) => r.requirementId));
    const caseIds = new Set(rows.map((r) => r.caseId));
    const withRun = rows.filter((r) => r.runId != null).length;
    const withDefect = rows.filter((r) => r.defects.length > 0).length;
    return [
      { label: "Links", value: rows.length, tone: "neutral" as const, hint: "Requirement × case rows" },
      { label: "Requirements", value: reqIds.size, tone: "violet" as const },
      { label: "Cases", value: caseIds.size, tone: "neutral" as const },
      { label: "With run", value: withRun, tone: "emerald" as const },
      { label: "With defects", value: withDefect, tone: "rose" as const }
    ];
  }, [rows]);

  if (q.isLoading) return <LoadingState message="Loading traceability…" />;
  if (q.isError) return <ErrorState title="Could not load traceability" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Traceability"
        description="Requirement links to cases and the latest execution context (run, status, defects)."
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel title="Matrix">
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No requirement links.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Requirement</th>
                  <th className="py-2 pr-2">Case</th>
                  <th className="py-2 pr-2">Latest run</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2">Defects</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.requirementId}-${row.caseId}`} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-900">{row.requirementKey}</p>
                      <p className="text-xs text-slate-500">{row.requirementTitle}</p>
                    </td>
                    <td className="py-2 pr-2">
                      <Link className="text-indigo-800 hover:underline" to={`/projects/${projectId}/cases?caseId=${row.caseId}`}>
                        {row.caseTitle}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">
                      {row.runId && row.runName ? (
                        <Link className="text-indigo-800 hover:underline" to={`/projects/${projectId}/runs/${row.runId}`}>
                          {row.runName}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">{row.latestStatus}</td>
                    <td className="py-2 text-xs text-slate-600">{row.defects.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportTablePanel>
    </div>
  );
}
