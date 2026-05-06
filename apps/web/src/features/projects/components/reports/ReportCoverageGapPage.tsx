import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

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
  coverageStatus: string;
  linkedCaseCount: number;
};

export function ReportCoverageGapPage() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: reportKeys.coverageGap(projectId),
    queryFn: async (): Promise<Row[]> => {
      const res = await apiFetch<Ok<{ items: Row[] }>>(`/api/projects/${projectId}/reports/coverage-gap`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const summaryItems = useMemo(() => {
    if (rows.length === 0) return [];
    const covered = rows.filter((r) => r.linkedCaseCount > 0).length;
    const gaps = rows.length - covered;
    const totalCases = rows.reduce((acc, r) => acc + r.linkedCaseCount, 0);
    return [
      { label: "Requirements", value: rows.length, tone: "neutral" as const },
      { label: "With cases", value: covered, tone: "emerald" as const },
      { label: "Gaps", value: gaps, tone: gaps > 0 ? ("amber" as const) : ("neutral" as const), hint: "Requirements with zero linked cases" },
      { label: "Linked cases", value: totalCases, tone: "violet" as const }
    ];
  }, [rows]);

  if (q.isLoading) return <LoadingState message="Loading coverage gap…" />;
  if (q.isError) return <ErrorState title="Could not load coverage gap" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Coverage gap"
        description="Requirements versus linked test cases—use this to find missing test coverage."
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel title="Requirements">
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No requirements.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Requirement</th>
                  <th className="py-2 pr-2">Cases</th>
                  <th className="py-2">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.requirementId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-900">{row.requirementKey}</p>
                      <p className="text-xs text-slate-500">{row.requirementTitle}</p>
                    </td>
                    <td className="py-2 pr-2">{row.linkedCaseCount}</td>
                    <td className="py-2">{row.coverageStatus}</td>
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
