import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchRuns } from "../../../runs/api/runApi";
import { fetchResultsPropertyDistribution } from "../../api/resultReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportFilterBar,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportResultsPropertyDistributionPage() {
  const { projectId = "" } = useParams();
  const [field, setField] = useState("status");
  const [runId, setRunId] = useState("");

  const runsQuery = useQuery({
    queryKey: ["runs", projectId, "results-property-distribution"],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
  });

  const queryOptions = useMemo(
    () => ({
      field,
      ...(runId ? { runId } : {})
    }),
    [field, runId]
  );

  const exportQuery = useMemo(
    () => ({
      field,
      ...(runId ? { runId } : {})
    }),
    [field, runId]
  );

  const q = useQuery({
    queryKey: reportKeys.resultsPropertyDistribution(projectId, queryOptions),
    queryFn: () => fetchResultsPropertyDistribution(projectId, queryOptions),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const fields = report?.fields ?? [];
  const rows = report?.items ?? [];

  const summaryItems = useMemo(
    () => [
      { label: "Results", value: report?.totalResults ?? 0, tone: "neutral" as const },
      { label: "Buckets", value: rows.length, tone: "violet" as const },
      { label: "Top count", value: rows[0]?.count ?? 0, tone: "emerald" as const }
    ],
    [report?.totalResults, rows]
  );

  if (q.isLoading) return <LoadingState message="Loading results property distribution..." />;
  if (q.isError) {
    return <ErrorState title="Could not load results property distribution" onRetry={() => void q.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Results property distribution"
        description="Break down latest results by status, source, version, or active result custom fields."
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
          },
          {
            kind: "select",
            id: "run",
            label: "Run",
            value: runId,
            onChange: setRunId,
            options: [
              { value: "", label: "All runs" },
              ...(runsQuery.data ?? []).map((run) => ({ value: run.id, label: run.name }))
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Distribution"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="results_property_distribution"
              filters={{ ui: { field, runId }, export: exportQuery }}
            />
            <ReportExportActions
              projectId={projectId}
              reportType="results_property_distribution"
              disabled={rows.length === 0}
              exportQuery={exportQuery}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No result data for the selected scope.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Value</th>
                  <th className="py-2 pr-2">Count</th>
                  <th className="py-2">Percent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.value} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-medium text-slate-900">{row.label}</td>
                    <td className="py-2 pr-2 tabular-nums">{row.count}</td>
                    <td className="py-2 tabular-nums">{row.percent}%</td>
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
