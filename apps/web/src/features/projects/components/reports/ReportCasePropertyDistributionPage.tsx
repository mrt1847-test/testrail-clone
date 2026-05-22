import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchCasePropertyDistribution } from "../../api/casePropertyReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import { formatDistributionTableLines } from "../../reports/reportSummaryText";
import { uiFiltersForReport } from "../../reports/reportExportQuery";
import {
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";
import { ReportToolbar } from "./ReportToolbar";

export function ReportCasePropertyDistributionPage() {
  const { projectId = "" } = useParams();
  const [field, setField] = useState("priority");

  const q = useQuery({
    queryKey: reportKeys.casePropertyDistribution(projectId, field),
    queryFn: () => fetchCasePropertyDistribution(projectId, field),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const fields = report?.fields ?? [];
  const rows = report?.items ?? [];
  const exportQuery = useMemo(() => ({ field }), [field]);
  const summaryItems = useMemo(
    () => [
      { label: "Cases", value: report?.totalCases ?? 0, tone: "neutral" as const },
      { label: "Buckets", value: rows.length, tone: "violet" as const },
      { label: "Top count", value: rows[0]?.count ?? 0, tone: "emerald" as const }
    ],
    [report?.totalCases, rows]
  );

  if (q.isLoading) return <LoadingState message="Loading case property distribution..." />;
  if (q.isError) return <ErrorState title="Could not load case property distribution" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Cases property distribution"
        description="Break down active cases by system fields and active case custom fields."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "select",
            id: "field",
            label: "Property",
            value: report?.selectedField ?? field,
            onChange: setField,
            options: fields.map((item) => ({ value: item.key, label: item.label }))
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Distribution"
        tableSummaryLines={formatDistributionTableLines(rows)}
        toolbar={
          <ReportToolbar
            projectId={projectId}
            reportType="cases_property_distribution"
            filters={{ ui: uiFiltersForReport({ field }), export: exportQuery }}
            exportQuery={exportQuery}
            disabled={rows.length === 0}
          />
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No cases found for this property.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Value</th>
                  <th className="py-2 pr-2">Cases</th>
                  <th className="py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.value} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-medium text-slate-800">{row.label}</td>
                    <td className="py-2 pr-2 text-slate-700">{row.count}</td>
                    <td className="py-2 text-slate-700">{row.percent}%</td>
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
