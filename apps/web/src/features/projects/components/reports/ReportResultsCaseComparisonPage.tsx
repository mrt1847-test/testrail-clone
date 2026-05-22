import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { StatusBadge } from "../../../../shared/ui/StatusBadge";
import { fetchRuns } from "../../../runs/api/runApi";
import { buildRunComparisonPath } from "../../../runs/utils/runComparisonUrl";
import { fetchResultsCaseComparison } from "../../api/resultReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import { uiFiltersForReport } from "../../reports/reportExportQuery";
import {
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";
import { ReportToolbar } from "./ReportToolbar";

type Props = {
  context?: "report" | "runs";
};

function ComparisonStatusCell({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <StatusBadge status={status} />;
}

export function ReportResultsCaseComparisonPage({ context = "report" }: Props) {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRunsContext = context === "runs";
  const [runIdA, setRunIdA] = useState(() => searchParams.get("runA") ?? searchParams.get("runIdA") ?? "");
  const [runIdB, setRunIdB] = useState(() => searchParams.get("runB") ?? searchParams.get("runIdB") ?? "");
  const [changeFilter, setChangeFilter] = useState(() => searchParams.get("change") ?? "all");

  useEffect(() => {
    const a = searchParams.get("runA") ?? searchParams.get("runIdA");
    const b = searchParams.get("runB") ?? searchParams.get("runIdB");
    const change = searchParams.get("change");
    if (a != null) setRunIdA(a);
    if (b != null) setRunIdB(b);
    if (change) setChangeFilter(change);
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (isRunsContext) {
      if (runIdA) next.set("runA", runIdA);
      if (runIdB) next.set("runB", runIdB);
      if (changeFilter !== "all") next.set("change", changeFilter);
      setSearchParams(next, { replace: true });
      return;
    }
    if (runIdA) next.set("runIdA", runIdA);
    if (runIdB) next.set("runIdB", runIdB);
    if (changeFilter !== "all") next.set("change", changeFilter);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [changeFilter, isRunsContext, runIdA, runIdB, searchParams, setSearchParams]);

  const runsQuery = useQuery({
    queryKey: ["runs", projectId, "results-comparison"],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
  });

  const runOptions = (runsQuery.data ?? []).map((run) => ({ value: run.id, label: run.name }));
  const canCompare = Boolean(runIdA && runIdB && runIdA !== runIdB);
  const pageTitle = isRunsContext ? "Compare runs" : "Results comparison for cases";
  const pageDescription = isRunsContext
    ? "Side-by-side status for cases shared between two test runs."
    : "Compare latest test statuses for cases that appear in two runs.";

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

  const filterFields = [
    {
      kind: "select" as const,
      id: "runA",
      label: "Run A",
      value: runIdA,
      onChange: setRunIdA,
      options: canCompare ? runOptions : [{ value: "", label: "Select run…" }, ...runOptions]
    },
    {
      kind: "select" as const,
      id: "runB",
      label: "Run B",
      value: runIdB,
      onChange: setRunIdB,
      options: canCompare ? runOptions : [{ value: "", label: "Select run…" }, ...runOptions]
    },
    ...(canCompare
      ? [
          {
            kind: "select" as const,
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
        ]
      : [])
  ];

  const contextNav = isRunsContext ? (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link className="font-medium text-indigo-800 hover:underline" to={`/projects/${projectId}/runs`}>
        ← Test runs
      </Link>
      {runIdA ? (
        <Link className="text-slate-600 hover:underline" to={`/projects/${projectId}/runs/${runIdA}`}>
          Open run A
        </Link>
      ) : null}
      {runIdB ? (
        <Link className="text-slate-600 hover:underline" to={`/projects/${projectId}/runs/${runIdB}`}>
          Open run B
        </Link>
      ) : null}
      {canCompare ? (
        <Link
          className="text-slate-600 hover:underline"
          to={`/projects/${projectId}/reports/results-comparison?runIdA=${runIdA}&runIdB=${runIdB}`}
        >
          Open in Reports
        </Link>
      ) : null}
    </div>
  ) : null;

  if (runsQuery.isLoading) return <LoadingState message="Loading runs…" />;
  if (!canCompare) {
    return (
      <div className="space-y-3">
        {contextNav}
        <ReportPageHeader title={pageTitle} description={pageDescription} />
        <ReportFilterBar fields={filterFields} />
        <p className="text-sm text-slate-500">Select two different runs to compare case results side-by-side.</p>
      </div>
    );
  }

  if (q.isLoading) return <LoadingState message="Loading comparison…" />;
  if (q.isError) return <ErrorState title="Could not load run comparison" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      {contextNav}
      <ReportPageHeader
        title={pageTitle}
        description={`${q.data?.runA.name ?? "Run A"} versus ${q.data?.runB.name ?? "Run B"}.`}
      />
      <ReportFilterBar fields={filterFields} />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Cases"
        toolbar={
          <ReportToolbar
            projectId={projectId}
            reportType="results_case_comparison"
            filters={{
              ui: uiFiltersForReport({
                ...(isRunsContext ? { runA: runIdA, runB: runIdB } : { runIdA, runIdB }),
                change: changeFilter
              }),
              export: exportQuery
            }}
            exportQuery={exportQuery}
            disabled={rows.length === 0}
            extra={
              isRunsContext ? null : (
                <Link
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  to={buildRunComparisonPath(projectId, { runIdA, runIdB, change: changeFilter })}
                >
                  Open run shortcut
                </Link>
              )
            }
          />
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
                    <td className="py-2 pr-2">
                      <ComparisonStatusCell status={row.statusA} />
                    </td>
                    <td className="py-2 pr-2">
                      <ComparisonStatusCell status={row.statusB} />
                    </td>
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
