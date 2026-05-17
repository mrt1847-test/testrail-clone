import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchRuns } from "../../../runs/api/runApi";
import { fetchResultsCaseComparison } from "../../api/resultReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportFilterBar,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportResultsCaseComparisonPage() {
  const { projectId = "" } = useParams();
  const [runIdA, setRunIdA] = useState("");
  const [runIdB, setRunIdB] = useState("");
  const [changeFilter, setChangeFilter] = useState("all");

  const runsQuery = useQuery({
    queryKey: ["runs", projectId, "results-comparison"],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
  });

  const runOptions = (runsQuery.data ?? []).map((run) => ({ value: run.id, label: run.name }));
  const canCompare = Boolean(runIdA && runIdB && runIdA !== runIdB);

  const q = useQuery({
    queryKey: reportKeys.resultsCaseComparison(projectId, runIdA, runIdB),
    queryFn: () => fetchResultsCaseComparison(projectId, runIdA, runIdB),
    enabled: Boolean(projectId) && canCompare
  });

  const exportQuery = useMemo(() => ({ runIdA, runIdB }), [runIdA, runIdB]);

  const rows = useMemo(() => {
    const items = q.data?.items ?? [];
    if (changeFilter === "changed") return items.filter((row) => row.changed);
    if (changeFilter === "unchanged") return items.filter((row) => row.statusA && row.statusB && !row.changed);
    if (changeFilter === "only_a") return items.filter((row) => row.onlyInRunA);
    if (changeFilter === "only_b") return items.filter((row) => row.onlyInRunB);
    return items;
  }, [q.data?.items, changeFilter]);

  const summaryItems = useMemo(() => {
    const summary = q.data?.summary;
    if (!summary) return [];
    return [
      { label: "Compared cases", value: summary.comparedCaseCount, tone: "neutral" as const },
      { label: "Changed", value: summary.changedCount, tone: "amber" as const },
      { label: "Unchanged", value: summary.unchangedCount, tone: "emerald" as const },
      { label: "Only run A", value: summary.onlyInRunACount, tone: "violet" as const },
      { label: "Only run B", value: summary.onlyInRunBCount, tone: "rose" as const }
    ];
  }, [q.data?.summary]);

  if (runsQuery.isLoading) return <LoadingState message="Loading runs…" />;
  if (!canCompare) {
    return (
      <div className="space-y-3">
        <ReportPageHeader
          title="Results comparison for cases"
          description="Compare latest test statuses for cases that appear in two runs."
        />
        <ReportFilterBar
          fields={[
            {
              kind: "select",
              id: "runA",
              label: "Run A",
              value: runIdA,
              onChange: setRunIdA,
              options: [{ value: "", label: "Select run…" }, ...runOptions]
            },
            {
              kind: "select",
              id: "runB",
              label: "Run B",
              value: runIdB,
              onChange: setRunIdB,
              options: [{ value: "", label: "Select run…" }, ...runOptions]
            }
          ]}
        />
        <p className="text-sm text-slate-500">Select two different runs to compare case results.</p>
      </div>
    );
  }

  if (q.isLoading) return <LoadingState message="Loading results comparison…" />;
  if (q.isError) return <ErrorState title="Could not load results comparison" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Results comparison for cases"
        description={`${q.data?.runA.name ?? "Run A"} versus ${q.data?.runB.name ?? "Run B"}.`}
      />
      <ReportFilterBar
        fields={[
          {
            kind: "select",
            id: "runA",
            label: "Run A",
            value: runIdA,
            onChange: setRunIdA,
            options: runOptions
          },
          {
            kind: "select",
            id: "runB",
            label: "Run B",
            value: runIdB,
            onChange: setRunIdB,
            options: runOptions
          },
          {
            kind: "select",
            id: "change",
            label: "Change",
            value: changeFilter,
            onChange: setChangeFilter,
            options: [
              { value: "all", label: "All cases" },
              { value: "changed", label: "Changed only" },
              { value: "unchanged", label: "Unchanged only" },
              { value: "only_a", label: "Only in run A" },
              { value: "only_b", label: "Only in run B" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Cases"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="results_case_comparison"
              filters={{ ui: { runIdA, runIdB, change: changeFilter }, export: exportQuery }}
            />
            <ReportExportActions
              projectId={projectId}
              reportType="results_case_comparison"
              disabled={rows.length === 0}
              exportQuery={exportQuery}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No cases match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Case</th>
                  <th className="py-2 pr-2">{q.data?.runA.name ?? "Run A"}</th>
                  <th className="py-2 pr-2">{q.data?.runB.name ?? "Run B"}</th>
                  <th className="py-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.caseId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/cases/${row.caseId}`}
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 capitalize">{row.statusA ?? "—"}</td>
                    <td className="py-2 pr-2 capitalize">{row.statusB ?? "—"}</td>
                    <td className="py-2 text-xs text-slate-600">
                      {row.onlyInRunA ? "Only A" : row.onlyInRunB ? "Only B" : row.changed ? "Changed" : "Same"}
                    </td>
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
