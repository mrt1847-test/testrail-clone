import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchRuns } from "../../../runs/api/runApi";
import { fetchRefsComparison } from "../../api/refsReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportFilterBar,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportRefsComparisonPage() {
  const { projectId = "" } = useParams();
  const [runIdA, setRunIdA] = useState("");
  const [runIdB, setRunIdB] = useState("");
  const [changeFilter, setChangeFilter] = useState("all");

  const runsQuery = useQuery({
    queryKey: ["runs", projectId, "refs-comparison"],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
  });

  const runOptions = (runsQuery.data ?? []).map((run) => ({ value: run.id, label: run.name }));
  const canCompare = Boolean(runIdA && runIdB && runIdA !== runIdB);
  const exportQuery = useMemo(() => ({ runIdA, runIdB }), [runIdA, runIdB]);

  const q = useQuery({
    queryKey: reportKeys.refsComparison(projectId, runIdA, runIdB),
    queryFn: () => fetchRefsComparison(projectId, runIdA, runIdB),
    enabled: Boolean(projectId) && canCompare
  });

  const rows = useMemo(() => {
    const items = q.data?.items ?? [];
    if (changeFilter === "changed") return items.filter((row) => row.changed);
    if (changeFilter === "unchanged") return items.filter((row) => row.statusA && row.statusB && !row.changed);
    return items;
  }, [q.data?.items, changeFilter]);

  const summaryItems = useMemo(() => {
    const summary = q.data?.summary;
    if (!summary) return [];
    return [
      { label: "References", value: summary.comparedRefCount, tone: "neutral" as const },
      { label: "Changed", value: summary.changedCount, tone: "amber" as const },
      { label: "Unchanged", value: summary.unchangedCount, tone: "emerald" as const }
    ];
  }, [q.data?.summary]);

  if (runsQuery.isLoading) return <LoadingState message="Loading runs..." />;
  if (!canCompare) {
    return (
      <div className="space-y-3">
        <ReportPageHeader
          title="References comparison"
          description="Compare execution status per reference ID between two runs (case References field)."
        />
        <ReportFilterBar
          fields={[
            {
              kind: "select",
              id: "runA",
              label: "Run A",
              value: runIdA,
              onChange: setRunIdA,
              options: [{ value: "", label: "Select run..." }, ...runOptions]
            },
            {
              kind: "select",
              id: "runB",
              label: "Run B",
              value: runIdB,
              onChange: setRunIdB,
              options: [{ value: "", label: "Select run..." }, ...runOptions]
            }
          ]}
        />
        <p className="text-sm text-slate-500">Select two different runs to compare references.</p>
      </div>
    );
  }

  if (q.isLoading) return <LoadingState message="Loading references comparison..." />;
  if (q.isError) return <ErrorState title="Could not load references comparison" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="References comparison"
        description={`${q.data?.runA.name ?? "Run A"} versus ${q.data?.runB.name ?? "Run B"} by reference ID.`}
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
              { value: "all", label: "All references" },
              { value: "changed", label: "Changed only" },
              { value: "unchanged", label: "Unchanged only" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="References"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="refs_comparison"
              filters={{ ui: { runIdA, runIdB, change: changeFilter }, export: exportQuery }}
            />
            <ReportExportActions
              projectId={projectId}
              reportType="refs_comparison"
              disabled={rows.length === 0}
              exportQuery={exportQuery}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No references match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Reference</th>
                  <th className="py-2 pr-2">Cases</th>
                  <th className="py-2 pr-2">{q.data?.runA.name ?? "Run A"}</th>
                  <th className="py-2 pr-2">{q.data?.runB.name ?? "Run B"}</th>
                  <th className="py-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.refKey} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/cases?q=${encodeURIComponent(row.refKey)}`}
                      >
                        {row.refKey}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">{row.linkedCaseCount}</td>
                    <td className="py-2 pr-2 capitalize">{row.statusA ?? "—"}</td>
                    <td className="py-2 pr-2 capitalize">{row.statusB ?? "—"}</td>
                    <td className="py-2 text-xs text-slate-600">{row.changed ? "Changed" : "Same"}</td>
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
