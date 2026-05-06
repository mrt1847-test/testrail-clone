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
  linkedCaseCount: number;
  atRiskResultCount: number;
  linkedDefectCount: number;
  defectKeys: string[];
  defectCoverage: string;
};

export function ReportDefectCoveragePage() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: reportKeys.defectCoverage(projectId),
    queryFn: async (): Promise<Row[]> => {
      const res = await apiFetch<Ok<{ items: Row[] }>>(`/api/projects/${projectId}/reports/defect-coverage`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const summaryItems = useMemo(() => {
    if (rows.length === 0) return [];
    const atRisk = rows.reduce((acc, r) => acc + r.atRiskResultCount, 0);
    const defectLinks = rows.reduce((acc, r) => acc + r.linkedDefectCount, 0);
    const withDefects = rows.filter((r) => r.linkedDefectCount > 0).length;
    return [
      { label: "Requirements", value: rows.length, tone: "neutral" as const },
      { label: "At-risk results", value: atRisk, tone: "amber" as const },
      { label: "Defect links", value: defectLinks, tone: "rose" as const },
      { label: "Reqs w/ defects", value: withDefects, tone: "violet" as const }
    ];
  }, [rows]);

  if (q.isLoading) return <LoadingState message="Loading defect coverage…" />;
  if (q.isError) return <ErrorState title="Could not load defect coverage" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Defect coverage"
        description="Defect signals rolled up by requirement for risk review."
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel title="Requirements">
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No requirements.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Requirement</th>
                  <th className="py-2 pr-2">At-risk</th>
                  <th className="py-2 pr-2">Defect keys</th>
                  <th className="py-2">Link state</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.requirementId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-900">{row.requirementKey}</p>
                      <p className="text-xs text-slate-500">{row.requirementTitle}</p>
                    </td>
                    <td className="py-2 pr-2">{row.atRiskResultCount}</td>
                    <td className="py-2 pr-2 text-xs text-slate-600">{row.defectKeys.join(", ") || "—"}</td>
                    <td className="py-2">{row.defectCoverage}</td>
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
