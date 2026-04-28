import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchMilestone, fetchProjectMembers } from "../../projects/api/advancedApi";
import type { TestInstanceRow } from "../types";
import {
  useAddRunResultMutation,
  useCloseRunMutation,
  useRerunFailedMutation,
  useResultStepsQuery,
  useRunDetailQuery,
  useTestResultsQuery,
  useUpdateRunAssigneeMutation
} from "../hooks/useRunsApi";
import { CloseRunDialog } from "./CloseRunDialog";
import { ResultEntryPanel } from "./ResultEntryPanel";
import { ResultHistoryList } from "./ResultHistoryList";

export function RunDetailPage() {
  const { projectId = "", runId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useRunDetailQuery(projectId, runId);
  const milestoneId = data?.run.milestoneId ?? null;
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [closeRunDialogOpen, setCloseRunDialogOpen] = useState(false);
  const { data: history = [], isLoading: isHistoryLoading } = useTestResultsQuery(selected?.id);
  const { data: steps = [], isLoading: isStepsLoading } = useResultStepsQuery(selectedResultId ?? undefined);
  const membersQuery = useQuery({
    queryKey: ["run-assignee-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId)
  });
  const milestoneQuery = useQuery({
    queryKey: ["run-detail-milestone", projectId, milestoneId ?? ""],
    queryFn: () => fetchMilestone(projectId, milestoneId ?? ""),
    enabled: Boolean(projectId && milestoneId)
  });
  const addResultMutation = useAddRunResultMutation(projectId, runId);
  const closeRunMutation = useCloseRunMutation(projectId, runId);
  const assigneeMutation = useUpdateRunAssigneeMutation(projectId, runId);
  const rerunMutation = useRerunFailedMutation(projectId, runId);

  if (isLoading) return <LoadingState message="Loading run…" />;
  if (isError || !data) return <ErrorState title="Run not found" onRetry={() => refetch()} />;

  const { run, instances, counts } = data;

  useEffect(() => {
    setSelectedResultId(null);
  }, [selected?.id]);

  useEffect(() => {
    setAssigneeInput(run.assignedTo ?? "");
  }, [run.assignedTo]);

  return (
    <div className="space-y-4">
      <CloseRunDialog
        open={closeRunDialogOpen}
        runName={run.name}
        isPending={closeRunMutation.isPending}
        onCancel={() => setCloseRunDialogOpen(false)}
        onConfirm={async () => {
          await closeRunMutation.mutateAsync();
          setCloseRunDialogOpen(false);
        }}
      />
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase text-slate-500">Run</p>
        <h2 className="text-xl font-semibold text-slate-900">{run.name}</h2>
        <p className="text-sm text-slate-600">
          {run.status} {run.environment ? `· ${run.environment}` : ""}
        </p>
        {run.milestoneId ? (
          <p className="text-xs text-slate-500">
            milestone: {milestoneQuery.data?.name ?? `#${run.milestoneId}`}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">assignee: {run.assignedTo ?? "unassigned"}</p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">Passed {counts.passed}</span>
        <span className="rounded-md bg-red-50 px-2 py-1 text-red-900">Failed {counts.failed}</span>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">Blocked {counts.blocked}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-800">Retest {counts.retest}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">Untested {counts.untested}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Case</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {instances.map((row) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.id ? "bg-slate-100" : "cursor-pointer hover:bg-slate-50"}
                  onClick={() => setSelected(row)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{row.caseCode}</td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Result entry</h3>
          {selected ? (
            <div className="mt-3 space-y-4 text-sm text-slate-700">
              <ResultEntryPanel
                key={selected.id}
                instance={{
                  id: selected.id,
                  caseCode: selected.caseCode,
                  title: selected.title
                }}
                isSubmitting={addResultMutation.isPending}
                onSubmit={(payload) => {
                  void addResultMutation.mutateAsync({
                    testId: selected.id,
                    status: payload.status,
                    comment: payload.comment,
                    elapsed: payload.elapsed,
                    version: payload.version,
                    defects: payload.defects,
                    stepResults: payload.stepResults
                  });
                }}
              />
              <ResultHistoryList
                history={history}
                isHistoryLoading={isHistoryLoading}
                selectedResultId={selectedResultId}
                onSelectResult={setSelectedResultId}
                steps={steps}
                isStepsLoading={isStepsLoading}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a test instance to enter results.</p>
          )}

          <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run actions</h4>
            <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded border border-slate-300 px-2 py-1"
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(membersQuery.data ?? []).map((member) => (
                    <option key={member.id} value={member.userId}>
                      {member.name ?? member.email} ({member.role})
                    </option>
                  ))}
                </select>
                <button
                  className="rounded border border-slate-300 px-2 py-1"
                  disabled={assigneeMutation.isPending}
                  onClick={() => void assigneeMutation.mutateAsync(assigneeInput.trim() || null)}
                >
                  Assign
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                disabled={rerunMutation.isPending}
                onClick={() => void rerunMutation.mutateAsync()}
              >
                Rerun failed
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                disabled={run.status === "closed" || closeRunMutation.isPending}
                onClick={() => setCloseRunDialogOpen(true)}
              >
                Close run
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
