import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ChangeEvent } from "react";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchRuns } from "../../runs/api/runApi";
import { fetchAutomationSummary, fetchAutomationUploads, uploadAutomationResults } from "../api/advancedApi";

export function AutomationPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [runId, setRunId] = useState("");
  const [token, setToken] = useState("");
  const [atomic, setAtomic] = useState(false);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [selectedProviderFilter, setSelectedProviderFilter] = useState("all");
  const [sortMode, setSortMode] = useState<"recent" | "failure-rate">("recent");
  const [uploadPage, setUploadPage] = useState(1);
  const [pageJumpInput, setPageJumpInput] = useState("1");
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(
      {
        external_run_id: "ci-run-001",
        ci_provider: "github-actions",
        branch: "main",
        commit_sha: "abcdef123456",
        results: [{ case_id: 1, status: "passed", comment: "automation ok", elapsed: "8s" }]
      },
      null,
      2
    )
  );
  const [selectedPreset, setSelectedPreset] = useState<"pass-only" | "mixed" | "with-steps">("pass-only");
  const payloadPresets: Record<"pass-only" | "mixed" | "with-steps", string> = useMemo(
    () => ({
      "pass-only": JSON.stringify(
        {
          external_run_id: "ci-run-001",
          ci_provider: "github-actions",
          branch: "main",
          commit_sha: "abcdef123456",
          results: [{ case_id: 1, status: "passed", comment: "all green", elapsed: "8s" }]
        },
        null,
        2
      ),
      mixed: JSON.stringify(
        {
          external_run_id: "ci-run-002",
          ci_provider: "github-actions",
          branch: "main",
          commit_sha: "abcdef123456",
          results: [
            { case_id: 1, status: "passed", comment: "ok", elapsed: "6s" },
            { case_id: 2, status: "failed", comment: "assertion mismatch", elapsed: "11s", defects: ["JIRA-100"] }
          ]
        },
        null,
        2
      ),
      "with-steps": JSON.stringify(
        {
          external_run_id: "ci-run-003",
          ci_provider: "github-actions",
          branch: "main",
          commit_sha: "abcdef123456",
          results: [
            {
              case_id: 3,
              status: "failed",
              comment: "step-level failure",
              elapsed: "13s",
              stepResults: [
                { step_order: 1, status: "passed", actual: "login ok" },
                { step_order: 2, status: "failed", actual: "checkout api 500", comment: "cart endpoint failure" }
              ]
            }
          ]
        },
        null,
        2
      )
    }),
    []
  );

  const applyPreset = (preset: "pass-only" | "mixed" | "with-steps") => {
    setSelectedPreset(preset);
    setPayloadText(payloadPresets[preset]);
  };

  const handlePayloadFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileLoadError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      setPayloadText(JSON.stringify(parsed, null, 2));
    } catch {
      setFileLoadError("JSON 파일을 읽는 중 오류가 발생했습니다. 올바른 .json 파일인지 확인해주세요.");
    }
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["automation-summary", projectId],
    queryFn: () => fetchAutomationSummary(projectId),
    enabled: Boolean(projectId)
  });
  const uploadsQuery = useQuery({
    queryKey: ["automation-uploads", projectId],
    queryFn: () => fetchAutomationUploads(projectId),
    enabled: Boolean(projectId)
  });
  const runsQuery = useQuery({
    queryKey: ["runs", projectId],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
  });
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const parsed = JSON.parse(payloadText) as {
        results?: Array<{
          caseId?: string | number;
          case_id?: string | number;
          status: "untested" | "passed" | "failed" | "blocked" | "retest";
          comment?: string;
          elapsed?: string;
          version?: string;
          defects?: string[];
          stepResults?: Array<{
            stepOrder?: number;
            step_order?: number;
            status: "untested" | "passed" | "failed" | "blocked" | "retest";
            actualResult?: string;
            actual?: string;
            comment?: string;
          }>;
        }>;
        external_run_id?: string;
        ci_provider?: string;
        ci_build_id?: string;
        job_url?: string;
        commit_sha?: string;
        branch?: string;
        attempt?: number;
      };
      const runIdValue = runId.trim();
      const tokenValue = token.trim();
      if (!runIdValue) throw new Error("Run ID is required");
      if (!tokenValue) throw new Error("Automation token is required");
      const allowedStatuses = new Set(["untested", "passed", "failed", "blocked", "retest"]);
      const items = (parsed.results ?? []).map((item) => ({
        caseId: String(item.caseId ?? item.case_id ?? ""),
        status: item.status,
        comment: item.comment,
        elapsed: item.elapsed,
        version: item.version,
        defects: item.defects,
        stepResults: (item.stepResults ?? []).map((step) => ({
          stepOrder: Number(step.stepOrder ?? step.step_order),
          status: step.status,
          actualResult: step.actualResult ?? step.actual,
          comment: step.comment
        }))
      }));
      if (items.length === 0) throw new Error("results array is required");
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item.caseId || Number.isNaN(Number(item.caseId))) {
          throw new Error(`results[${i}].caseId(case_id) is required`);
        }
        if (!allowedStatuses.has(item.status)) {
          throw new Error(`results[${i}].status is invalid`);
        }
        for (let j = 0; j < item.stepResults.length; j += 1) {
          const step = item.stepResults[j];
          if (!Number.isInteger(step.stepOrder) || step.stepOrder < 1) {
            throw new Error(`results[${i}].stepResults[${j}].stepOrder(step_order) must be >= 1`);
          }
          if (!allowedStatuses.has(step.status)) {
            throw new Error(`results[${i}].stepResults[${j}].status is invalid`);
          }
        }
      }
      return uploadAutomationResults({
        runId: runIdValue,
        token: tokenValue,
        atomic,
        results: items,
        metadata: {
          externalRunId: parsed.external_run_id,
          ciProvider: parsed.ci_provider,
          ciBuildId: parsed.ci_build_id,
          jobUrl: parsed.job_url,
          commitSha: parsed.commit_sha,
          branch: parsed.branch,
          attempt: parsed.attempt
        }
      });
    },
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["automation-summary", projectId] }),
        qc.invalidateQueries({ queryKey: ["automation-uploads", projectId] })
      ]);
      navigate(`/projects/${projectId}/automation/uploads/${result.runId}`);
    }
  });
  const uploadErrorText = useMemo(() => {
    if (!uploadMutation.error) return null;
    if (!(uploadMutation.error instanceof Error)) return "업로드 중 알 수 없는 오류가 발생했습니다.";
    if (uploadMutation.error.message.includes("Unexpected token")) {
      return "Payload JSON 형식이 올바르지 않습니다. JSON 문법을 확인해주세요.";
    }
    return uploadMutation.error.message || "업로드에 실패했습니다.";
  }, [uploadMutation.error]);
  const providerFilterOptions = useMemo(() => {
    const providers = new Set<string>();
    for (const row of uploadsQuery.data ?? []) {
      if (row.ciProvider) providers.add(row.ciProvider);
    }
    return ["all", ...Array.from(providers).sort()];
  }, [uploadsQuery.data]);
  const filteredUploads = useMemo(() => {
    const source = uploadsQuery.data ?? [];
    const filtered = source
      .filter((row) => (showFailedOnly ? row.failed > 0 : true))
      .filter((row) => (selectedProviderFilter === "all" ? true : row.ciProvider === selectedProviderFilter))
      .map((row) => ({
        ...row,
        failureRate: row.total > 0 ? row.failed / row.total : 0
      }));
    if (sortMode === "failure-rate") {
      filtered.sort((a, b) => (b.failureRate === a.failureRate ? Number(b.id) - Number(a.id) : b.failureRate - a.failureRate));
    }
    return filtered;
  }, [uploadsQuery.data, selectedProviderFilter, showFailedOnly, sortMode]);
  const uploadPageSize = 5;
  const totalUploadPages = Math.max(1, Math.ceil(filteredUploads.length / uploadPageSize));
  const currentUploadPage = Math.min(uploadPage, totalUploadPages);
  const pagedUploads = useMemo(() => {
    const start = (currentUploadPage - 1) * uploadPageSize;
    return filteredUploads.slice(start, start + uploadPageSize);
  }, [currentUploadPage, filteredUploads]);
  const goToUploadPage = (page: number) => {
    const clamped = Math.min(totalUploadPages, Math.max(1, page));
    setUploadPage(clamped);
    setPageJumpInput(String(clamped));
  };

  if (isLoading) return <LoadingState message="Loading automation dashboard…" />;
  if (isError || !data) return <ErrorState title="Could not load automation dashboard" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Automation Summary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Mapped cases</p>
            <p className="text-xl font-semibold text-slate-900">{data.mappedCases}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Uploads</p>
            <p className="text-xl font-semibold text-slate-900">{data.uploadedRuns}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Last upload</p>
            <p className="text-sm font-medium text-slate-800">{data.lastUploadAt ?? "—"}</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Run upload</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            Run
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
            >
              <option value="">Select run</option>
              {(runsQuery.data ?? []).map((run) => (
                <option key={run.id} value={run.id}>
                  #{run.id} {run.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Automation token
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="tok_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} />
          Atomic upload
        </label>
        <label className="mt-2 block text-xs text-slate-600">
          Payload JSON
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              className={`rounded border px-2 py-0.5 text-xs ${selectedPreset === "pass-only" ? "border-slate-900 text-slate-900" : "border-slate-300 text-slate-600"}`}
              onClick={() => applyPreset("pass-only")}
            >
              Pass only
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-0.5 text-xs ${selectedPreset === "mixed" ? "border-slate-900 text-slate-900" : "border-slate-300 text-slate-600"}`}
              onClick={() => applyPreset("mixed")}
            >
              Mixed
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-0.5 text-xs ${selectedPreset === "with-steps" ? "border-slate-900 text-slate-900" : "border-slate-300 text-slate-600"}`}
              onClick={() => applyPreset("with-steps")}
            >
              With steps
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <label className="cursor-pointer rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700">
              Load JSON file
              <input type="file" accept=".json,application/json" className="hidden" onChange={handlePayloadFileChange} />
            </label>
            {fileLoadError ? <span className="text-xs text-rose-600">{fileLoadError}</span> : null}
          </div>
          <textarea
            className="mt-1 h-44 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
          />
        </label>
        <div className="mt-2 flex items-center gap-2">
          <button
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50"
            disabled={uploadMutation.isPending}
            onClick={() => void uploadMutation.mutateAsync()}
          >
            Upload results
          </button>
          {uploadErrorText ? <span className="text-xs text-rose-600">{uploadErrorText}</span> : null}
        </div>
        {uploadMutation.data ? (
          <p className="mt-2 text-xs text-emerald-700">
            Uploaded: total {uploadMutation.data.total} / saved {uploadMutation.data.saved} / failed{" "}
            {uploadMutation.data.failed}
          </p>
        ) : null}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent uploads</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={showFailedOnly}
              onChange={(e) => {
                setShowFailedOnly(e.target.checked);
                setUploadPage(1);
                setPageJumpInput("1");
              }}
            />
            Failed only
          </label>
          <label className="flex items-center gap-1">
            Provider
            <select
              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={selectedProviderFilter}
              onChange={(e) => {
                setSelectedProviderFilter(e.target.value);
                setUploadPage(1);
                setPageJumpInput("1");
              }}
            >
              {providerFilterOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider === "all" ? "All" : provider}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Sort
            <select
              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as "recent" | "failure-rate");
                setUploadPage(1);
                setPageJumpInput("1");
              }}
            >
              <option value="recent">Recent</option>
              <option value="failure-rate">Failure rate</option>
            </select>
          </label>
        </div>
        {uploadsQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading uploads…</p>
        ) : uploadsQuery.isError ? (
          <p className="mt-2 text-sm text-rose-600">Could not load uploads.</p>
        ) : filteredUploads.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No upload history yet.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2 text-sm">
              {pagedUploads.map((upload) => (
                <li key={upload.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                  <span>
                    #{upload.id} · failed {upload.failed} / {upload.total}
                    {upload.total > 0 ? ` · ${(upload.failureRate * 100).toFixed(0)}% fail` : ""}
                    {upload.ciProvider ? ` · ${upload.ciProvider}` : ""}
                    {upload.branch ? ` · ${upload.branch}` : ""}
                  </span>
                  <Link to={`/projects/${projectId}/automation/uploads/${upload.id}`} className="text-slate-700 underline">
                    Detail
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {currentUploadPage} / {totalUploadPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={currentUploadPage <= 1}
                  onClick={() => goToUploadPage(1)}
                >
                  First
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={currentUploadPage <= 1}
                  onClick={() => goToUploadPage(currentUploadPage - 1)}
                >
                  Prev
                </button>
                <input
                  type="number"
                  min={1}
                  max={totalUploadPages}
                  className="w-14 rounded border border-slate-300 px-1 py-1 text-xs"
                  value={pageJumpInput}
                  onChange={(e) => setPageJumpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const parsed = Number(pageJumpInput);
                    goToUploadPage(Number.isFinite(parsed) ? parsed : currentUploadPage);
                  }}
                  onBlur={() => {
                    const parsed = Number(pageJumpInput);
                    goToUploadPage(Number.isFinite(parsed) ? parsed : currentUploadPage);
                  }}
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={currentUploadPage >= totalUploadPages}
                  onClick={() => goToUploadPage(currentUploadPage + 1)}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={currentUploadPage >= totalUploadPages}
                  onClick={() => goToUploadPage(totalUploadPages)}
                >
                  Last
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="text-sm">
        <Link to={`/projects/${projectId}/settings/tokens`} className="text-slate-700 underline">
          API tokens
        </Link>
      </p>
    </div>
  );
}
