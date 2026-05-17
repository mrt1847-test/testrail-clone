import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchRuns } from "../../../runs/api/runApi";
import { fetchDefectSummary, type DefectSummaryQuery } from "../../api/defectSummaryApi";
import { fetchMilestones, fetchPlans } from "../../api/planningApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportSaveViewButton,
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

type ScopeType = "project" | "milestone" | "plan" | "run";

function buildScopeQuery(scopeType: ScopeType, scopeId: string): DefectSummaryQuery {
  if (scopeType === "milestone" && scopeId) return { milestoneId: scopeId };
  if (scopeType === "plan" && scopeId) return { planId: scopeId };
  if (scopeType === "run" && scopeId) return { runId: scopeId };
  return {};
}

function buildExportQuery(scopeType: ScopeType, scopeId: string) {
  const query = buildScopeQuery(scopeType, scopeId);
  return {
    ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    ...(query.runId ? { runId: query.runId } : {})
  };
}

export function ReportDefectSummaryPage() {
  const { projectId = "" } = useParams();
  const [scopeType, setScopeType] = useState<ScopeType>("project");
  const [scopeId, setScopeId] = useState("");

  const scopeQuery = useMemo(() => buildScopeQuery(scopeType, scopeId), [scopeType, scopeId]);
  const exportQuery = useMemo(() => buildExportQuery(scopeType, scopeId), [scopeType, scopeId]);

  const milestonesQuery = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId) && scopeType === "milestone"
  });
  const plansQuery = useQuery({
    queryKey: ["plans", projectId],
    queryFn: () => fetchPlans(projectId),
    enabled: Boolean(projectId) && scopeType === "plan"
  });
  const runsQuery = useQuery({
    queryKey: ["runs", projectId, "defect-summary"],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId) && scopeType === "run"
  });

  const q = useQuery({
    queryKey: reportKeys.defectSummary(projectId, scopeQuery),
    queryFn: () => fetchDefectSummary(projectId, scopeQuery),
    enabled: Boolean(projectId) && (scopeType === "project" || scopeId.length > 0)
  });

  const report = q.data;
  const defects = report?.defects ?? [];
  const unlinked = report?.unlinkedAtRisk ?? [];

  const summaryItems = useMemo(() => {
    if (!report) return [];
    return [
      { label: "Scope", value: report.scope.label, tone: "neutral" as const },
      { label: "Runs", value: report.dashboard.runCount, tone: "neutral" as const },
      { label: "At-risk", value: report.dashboard.atRiskResultCount, tone: "amber" as const },
      { label: "Defects", value: report.dashboard.linkedDefectCount, tone: "violet" as const },
      {
        label: "Unlinked",
        value: report.dashboard.unlinkedAtRiskCount,
        tone: report.dashboard.unlinkedAtRiskCount > 0 ? ("rose" as const) : ("neutral" as const),
        hint: "Failed, blocked, or retest without a defect link"
      }
    ];
  }, [report]);

  const scopeOptions =
    scopeType === "milestone"
      ? (milestonesQuery.data ?? []).map((row) => ({ value: row.id, label: row.name }))
      : scopeType === "plan"
        ? (plansQuery.data ?? []).map((row) => ({ value: row.id, label: row.name }))
        : scopeType === "run"
          ? (runsQuery.data ?? []).map((row) => ({ value: row.id, label: row.name }))
          : [];

  if (q.isLoading) return <LoadingState message="Loading defect summary…" />;
  if (q.isError) return <ErrorState title="Could not load defect summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Defect summary"
        description="Defect links and unlinked at-risk results for a milestone, plan, run, or the whole project."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "select",
            id: "scopeType",
            label: "Scope",
            value: scopeType,
            onChange: (value) => {
              setScopeType(value as ScopeType);
              setScopeId("");
            },
            options: [
              { value: "project", label: "All runs" },
              { value: "milestone", label: "Milestone" },
              { value: "plan", label: "Plan" },
              { value: "run", label: "Run" }
            ]
          },
          ...(scopeType === "project"
            ? []
            : [
                {
                  kind: "select" as const,
                  id: "scopeId",
                  label: scopeType === "milestone" ? "Milestone" : scopeType === "plan" ? "Plan" : "Run",
                  value: scopeId,
                  onChange: setScopeId,
                  options: [{ value: "", label: "Select…" }, ...scopeOptions]
                }
              ])
        ]}
      />
      {scopeType !== "project" && !scopeId ? (
        <p className="text-sm text-slate-500">Select a {scopeType} to load the defect summary.</p>
      ) : (
        <>
          <ReportSummaryStrip items={summaryItems} />
          <ReportTablePanel
            title="Linked defects"
            toolbar={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ReportSaveViewButton
                  projectId={projectId}
                  reportType="defect_summary"
                  filters={{ ui: { scopeType, scopeId }, export: exportQuery }}
                />
                <ReportExportActions
                  projectId={projectId}
                  reportType="defect_summary"
                  disabled={defects.length === 0 && unlinked.length === 0}
                  exportQuery={exportQuery}
                />
              </div>
            }
          >
            {defects.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No linked defects in this scope.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-2">Defect</th>
                      <th className="py-2 pr-2">Results</th>
                      <th className="py-2 pr-2">Failed</th>
                      <th className="py-2 pr-2">Blocked</th>
                      <th className="py-2">Retest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defects.map((row) => (
                      <tr key={row.defectKey} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-medium text-slate-900">{row.defectKey}</td>
                        <td className="py-2 pr-2">{row.linkedResultCount}</td>
                        <td className="py-2 pr-2">{row.failedCount}</td>
                        <td className="py-2 pr-2">{row.blockedCount}</td>
                        <td className="py-2">{row.retestCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportTablePanel>
          <ReportTablePanel title="Unlinked at-risk results">
            {unlinked.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No failed, blocked, or retest results without defect links.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-2">Run</th>
                      <th className="py-2 pr-2">Test</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unlinked.map((row) => (
                      <tr key={row.resultId} className="border-b border-slate-100">
                        <td className="py-2 pr-2">
                          <Link
                            className="font-medium text-indigo-800 hover:underline"
                            to={`/projects/${projectId}/runs/${row.runId}`}
                          >
                            {row.runName}
                          </Link>
                        </td>
                        <td className="py-2 pr-2">
                          <Link
                            className="text-indigo-800 hover:underline"
                            to={`/projects/${projectId}/cases/${row.caseId}`}
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="py-2 pr-2 capitalize">{row.status}</td>
                        <td className="py-2 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportTablePanel>
        </>
      )}
    </div>
  );
}
