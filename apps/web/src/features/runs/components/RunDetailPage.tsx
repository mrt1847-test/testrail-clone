import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchProjectMembers } from "../../projects/api/advancedApi";
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

export function RunDetailPage() {
  const { projectId = "", runId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useRunDetailQuery(projectId, runId);
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<"passed" | "failed" | "blocked" | "retest" | "untested">("passed");
  const [comment, setComment] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [version, setVersion] = useState("");
  const [defects, setDefects] = useState("");
  const [step1Status, setStep1Status] = useState<"passed" | "failed" | "blocked" | "retest" | "untested">("passed");
  const [step1Comment, setStep1Comment] = useState("");
  const [assigneeInput, setAssigneeInput] = useState("");
  const { data: history = [], isLoading: isHistoryLoading } = useTestResultsQuery(selected?.id);
  const { data: steps = [], isLoading: isStepsLoading } = useResultStepsQuery(selectedResultId ?? undefined);
  const membersQuery = useQuery({
    queryKey: ["run-assignee-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId)
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
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase text-slate-500">Run</p>
        <h2 className="text-xl font-semibold text-slate-900">{run.name}</h2>
        <p className="text-sm text-slate-600">
          {run.status} {run.environment ? `· ${run.environment}` : ""}
        </p>
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
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-mono text-xs">{selected.caseCode}</span> — {selected.title}
              </p>
              <div className="rounded border border-slate-200 p-2">
                <p className="text-xs font-medium text-slate-700">Submit result</p>
                <div className="mt-2 flex gap-2">
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    value={nextStatus}
                    onChange={(e) =>
                      setNextStatus(e.target.value as "passed" | "failed" | "blocked" | "retest" | "untested")
                    }
                  >
                    <option value="passed">passed</option>
                    <option value="failed">failed</option>
                    <option value="blocked">blocked</option>
                    <option value="retest">retest</option>
                    <option value="untested">untested</option>
                  </select>
                  <input
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <input
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="elapsed"
                    value={elapsed}
                    onChange={(e) => setElapsed(e.target.value)}
                  />
                  <input
                    className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                  <input
                    className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="defects comma-separated"
                    value={defects}
                    onChange={(e) => setDefects(e.target.value)}
                  />
                  <button
                    className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                    disabled={addResultMutation.isPending}
                    onClick={() => {
                      void addResultMutation.mutateAsync({
                        testId: selected.id,
                        status: nextStatus,
                        comment: comment.trim() || undefined,
                        elapsed: elapsed.trim() || undefined,
                        version: version.trim() || undefined,
                        defects: defects
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                        stepResults: [
                          {
                            stepOrder: 1,
                            status: step1Status,
                            comment: step1Comment.trim() || undefined
                          }
                        ]
                      });
                      setComment("");
                      setElapsed("");
                      setVersion("");
                      setDefects("");
                      setStep1Comment("");
                    }}
                  >
                    Save
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    value={step1Status}
                    onChange={(e) =>
                      setStep1Status(e.target.value as "passed" | "failed" | "blocked" | "retest" | "untested")
                    }
                  >
                    <option value="passed">step1 passed</option>
                    <option value="failed">step1 failed</option>
                    <option value="blocked">step1 blocked</option>
                    <option value="retest">step1 retest</option>
                    <option value="untested">step1 untested</option>
                  </select>
                  <input
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="step1 comment"
                    value={step1Comment}
                    onChange={(e) => setStep1Comment(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Result history from{" "}
                <code className="rounded bg-slate-100 px-1">GET /api/tests/:testId/results</code>.
              </p>
              <div className="max-h-64 space-y-2 overflow-auto">
                {isHistoryLoading ? (
                  <p className="text-xs text-slate-500">Loading history…</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-slate-500">No results yet.</p>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className={
                        selectedResultId === item.id
                          ? "cursor-pointer rounded border border-slate-400 bg-slate-50 p-2"
                          : "cursor-pointer rounded border border-slate-200 p-2"
                      }
                      onClick={() => setSelectedResultId(item.id)}
                    >
                      <p className="text-xs font-medium text-slate-800">
                        {item.status} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {item.comment ? <p className="text-xs text-slate-700">{item.comment}</p> : null}
                      <p className="text-[11px] text-slate-500">
                        source={item.source}
                        {item.elapsed ? ` · elapsed=${item.elapsed}` : ""}
                        {item.version ? ` · version=${item.version}` : ""}
                      </p>
                      {item.defects.length > 0 ? (
                        <p className="text-[11px] text-slate-500">defects: {item.defects.join(", ")}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 rounded border border-slate-200 p-2">
                <p className="text-xs font-medium text-slate-700">Step results</p>
                {!selectedResultId ? (
                  <p className="mt-1 text-xs text-slate-500">Select a history item to inspect per-step results.</p>
                ) : isStepsLoading ? (
                  <p className="mt-1 text-xs text-slate-500">Loading step results…</p>
                ) : steps.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">No step results for this result.</p>
                ) : (
                  <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                    {steps.map((step) => (
                      <div key={step.id} className="rounded border border-slate-100 p-2">
                        <p className="text-[11px] font-medium text-slate-700">
                          Step {step.stepOrder} · {step.status}
                        </p>
                        {step.actualResult ? <p className="text-[11px] text-slate-600">{step.actualResult}</p> : null}
                        {step.comment ? <p className="text-[11px] text-slate-500">{step.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                disabled={run.status === "closed" || closeRunMutation.isPending}
                onClick={() => void closeRunMutation.mutateAsync()}
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
