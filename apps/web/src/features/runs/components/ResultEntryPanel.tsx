import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CommentComposer } from "../../comments/CommentComposer";
import { fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { Button, FormField, SaveFeedback } from "../../../shared/ui";
import { DefectKeyInput } from "./DefectKeyInput";
import { ElapsedTimerField } from "./ElapsedTimerField";
import {
  ResultCustomFields,
  validateCustomFieldValues,
  valueForSubmit
} from "./ResultCustomFields";
import { AiEvaluationResultFields } from "./AiEvaluationResultFields";
import { StepResultEditor } from "./StepResultEditor";
import { ScenarioResultEditor, createScenarioResultDrafts, type ScenarioResultDraft } from "./ScenarioResultEditor";
import type { CaseScenarioRow } from "../../cases/api/bddApi";
import { useProjectStatuses } from "../hooks/useProjectStatuses";
import type { ProjectStatusOption } from "../utils/projectStatuses";
import { StatusPicker, pickDefaultStatusOption } from "./StatusPicker";
import { ResultCorrectionPolicyHint } from "./ResultCorrectionPolicyHint";
import { UntestedPolicyHint } from "./UntestedPolicyHint";
import type { CaseStepContext, ResultStatus, ResultSubmitPayload, StepResultDraft } from "./resultEntryTypes";
import {
  createStepDraftsFromCaseSteps,
  formatElapsed,
  isBlankDefaultStepDrafts,
  normalizeElapsedInput,
  runningElapsedSeconds
} from "./resultEntryUtils";
import {
  applyCaseActualResult,
  canRemoveStagedComposerFile,
  mergeStagedComposerFiles,
  stagedComposerStatusLabel,
  type StagedComposerFile,
  type StagedComposerUploadPatch
} from "../utils/resultComposerModel";

export type { ResultStatus, ResultSubmitPayload } from "./resultEntryTypes";

type ResultEntryPanelProps = {
  projectId: string;
  instance: { id: string; caseId?: string; caseCode: string; title: string };
  caseSteps?: CaseStepContext[];
  caseScenarios?: CaseScenarioRow[];
  isCaseStepsLoading?: boolean;
  isSubmitting: boolean;
  disableUntested?: boolean;
  hasResultHistory?: boolean;
  aiEvaluation?: { expectedOutput?: string };
  showInstanceHeader?: boolean;
  initialStatus?: ResultStatus | null;
  onSubmit: (payload: ResultSubmitPayload) => void | Promise<void>;
  onCancel?: () => void;
  saveFeedback?: { status: "idle" | "saving" | "saved" | "failed"; message?: string; canUndo?: boolean } | null;
  onRetrySave?: () => void;
  onUndoSave?: () => void;
  attachmentUploadById?: Record<string, StagedComposerUploadPatch>;
  onRetryStagedAttachment?: (id: string) => void;
};

export function ResultEntryPanel({
  projectId,
  instance,
  caseSteps = [],
  caseScenarios = [],
  isCaseStepsLoading = false,
  isSubmitting,
  disableUntested = false,
  hasResultHistory = false,
  aiEvaluation,
  showInstanceHeader = true,
  initialStatus = null,
  onSubmit,
  onCancel,
  saveFeedback = null,
  onRetrySave,
  onUndoSave,
  attachmentUploadById,
  onRetryStagedAttachment
}: ResultEntryPanelProps) {
  const statusQuery = useProjectStatuses(projectId);
  const statusOptions = statusQuery.data ?? [];
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusOption | null>(null);
  const activeStatus = selectedStatus ?? pickDefaultStatusOption(statusOptions);
  const [comment, setComment] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [stagedFiles, setStagedFiles] = useState<StagedComposerFile[]>([]);
  const [elapsed, setElapsed] = useState("");
  const [elapsedError, setElapsedError] = useState("");
  const [elapsedBaseSeconds, setElapsedBaseSeconds] = useState(0);
  const [elapsedStartedAt, setElapsedStartedAt] = useState<number | null>(null);
  const [version, setVersion] = useState("");
  const [defects, setDefects] = useState<string[]>([]);
  const [customValueErrors, setCustomValueErrors] = useState<Record<string, string>>({});
  const [stepResults, setStepResults] = useState<StepResultDraft[]>(() => createStepDraftsFromCaseSteps(caseSteps));
  const [scenarioResults, setScenarioResults] = useState<ScenarioResultDraft[]>(() =>
    createScenarioResultDrafts(caseScenarios)
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [aiActualOutput, setAiActualOutput] = useState("");
  const [aiQualityRating, setAiQualityRating] = useState("");
  const [aiLatencyMs, setAiLatencyMs] = useState("");
  const [aiTraces, setAiTraces] = useState("");
  const showAiEvaluation = Boolean(aiEvaluation);

  const { data: resultFields = [] } = useQuery({
    queryKey: ["custom-fields", projectId, "result"],
    queryFn: () => fetchCustomFieldsForUse(projectId, "result"),
    enabled: Boolean(projectId)
  });
  const activeResultFields = resultFields.filter((field) => field.isActive);
  const isElapsedTimerRunning = elapsedStartedAt !== null;

  useEffect(() => {
    if (!isElapsedTimerRunning) return undefined;
    const intervalId = window.setInterval(() => {
      setElapsed(formatElapsed(runningElapsedSeconds(elapsedBaseSeconds, elapsedStartedAt)));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [elapsedBaseSeconds, elapsedStartedAt, isElapsedTimerRunning]);

  useEffect(() => {
    if (caseSteps.length === 0) return;
    setStepResults((current) => (isBlankDefaultStepDrafts(current) ? createStepDraftsFromCaseSteps(caseSteps) : current));
  }, [caseSteps]);

  useEffect(() => {
    if (caseScenarios.length === 0) return;
    setScenarioResults(createScenarioResultDrafts(caseScenarios));
  }, [caseScenarios]);

  useEffect(() => {
    if (elapsedError || Object.values(customValueErrors).some(Boolean)) setShowDetails(true);
  }, [customValueErrors, elapsedError]);

  useEffect(() => {
    if (!initialStatus || statusOptions.length === 0) return;
    const match =
      statusOptions.find((option) => option.canonicalStatus === initialStatus) ??
      pickDefaultStatusOption(statusOptions, initialStatus);
    setSelectedStatus(match);
  }, [initialStatus, statusOptions]);

  function startElapsedTimer() {
    const normalized = normalizeElapsedInput(elapsed);
    setElapsedError(normalized.error ?? "");
    if (normalized.error) return;
    const baseSeconds = normalized.seconds ?? 0;
    setElapsedBaseSeconds(baseSeconds);
    setElapsed(normalized.value ?? "");
    setElapsedStartedAt(Date.now());
  }

  function stopElapsedTimer() {
    const seconds = runningElapsedSeconds(elapsedBaseSeconds, elapsedStartedAt);
    setElapsedBaseSeconds(seconds);
    setElapsed(formatElapsed(seconds));
    setElapsedStartedAt(null);
  }

  function resetElapsedTimer() {
    setElapsedBaseSeconds(0);
    setElapsedStartedAt(null);
    setElapsed("");
    setElapsedError("");
  }

  function validateCustomValues() {
    const errors = validateCustomFieldValues(activeResultFields, customValues);
    setCustomValueErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    const elapsedForSubmit = isElapsedTimerRunning ? formatElapsed(runningElapsedSeconds(elapsedBaseSeconds, elapsedStartedAt)) : elapsed;
    const normalizedElapsed = normalizeElapsedInput(elapsedForSubmit);
    setElapsedError(normalizedElapsed.error ?? "");
    if (normalizedElapsed.error || !validateCustomValues()) return;

    const submittedCustomValues = Object.fromEntries(
      activeResultFields.map((field) => [field.systemName, valueForSubmit(field, customValues[field.systemName] ?? "")])
    );
    const parsedQuality = aiQualityRating.trim() ? Number(aiQualityRating) : undefined;
    const parsedLatency = aiLatencyMs.trim() ? Number(aiLatencyMs) : undefined;
    const trimmedActual = actualResult.trim();

    try {
      await onSubmit({
        status: activeStatus.canonicalStatus,
        comment: comment.trim() || undefined,
        elapsed: normalizedElapsed.value,
        version: version.trim() || undefined,
        defects,
        customValues: submittedCustomValues,
        actualResult: trimmedActual || undefined,
        attachments: stagedFiles.map((row) => row.file),
        stagedAttachments: stagedFiles.map((row) => ({ id: row.id, file: row.file })),
        ...(showAiEvaluation
          ? {
              aiActualOutput: aiActualOutput.trim() || undefined,
              aiQualityRating:
                parsedQuality !== undefined && Number.isInteger(parsedQuality) ? parsedQuality : undefined,
              aiLatencyMs: parsedLatency !== undefined && Number.isInteger(parsedLatency) ? parsedLatency : undefined,
              aiTraces: aiTraces.trim() || undefined
            }
          : {}),
        stepResults: applyCaseActualResult(
          stepResults.map((step, index) => ({
            stepOrder: Number.isInteger(step.stepOrder) && step.stepOrder > 0 ? step.stepOrder : index + 1,
            status: step.status,
            actualResult: step.actualResult.trim() || undefined,
            comment: step.comment.trim() || undefined
          })),
          trimmedActual
        ),
        scenarioResults:
          caseScenarios.length > 0
            ? scenarioResults.map((row) => ({
                caseScenarioId: row.caseScenarioId,
                status: row.status,
                comment: row.comment.trim() || undefined
              }))
            : undefined
      });
      resetComposerDraft();
    } catch {
      // Parent owns Failed/Retry; keep the entered evidence for recovery.
    }
  }

  function resetComposerDraft() {
    setSelectedStatus(null);
    setComment("");
    setActualResult("");
    setStagedFiles([]);
    setElapsed("");
    setElapsedError("");
    setElapsedBaseSeconds(0);
    setElapsedStartedAt(null);
    setVersion("");
    setDefects([]);
    setStepResults(createStepDraftsFromCaseSteps(caseSteps));
    setScenarioResults(createScenarioResultDrafts(caseScenarios));
    setCustomValues({});
    setCustomValueErrors({});
    setAiActualOutput("");
    setAiQualityRating("");
    setAiLatencyMs("");
    setAiTraces("");
    setShowDetails(false);
  }

  useEffect(() => {
    if (saveFeedback?.status === "saved") resetComposerDraft();
  }, [saveFeedback?.status]);

  function handleCancel() {
    resetComposerDraft();
    onCancel?.();
  }

  const detailsCount = [elapsed, version, activeResultFields.length > 0 ? "fields" : ""].filter(Boolean).length;
  const visibleStagedFiles = stagedFiles.map((row) => {
    const overlay = attachmentUploadById?.[row.id];
    return overlay ? { ...row, ...overlay } : row;
  });

  return (
    <div className="space-y-3 text-sm text-slate-700">
      {showInstanceHeader ? (
        <div className="min-w-0 border-b border-slate-100 pb-3">
          <p className="font-mono text-xs text-slate-500">{instance.caseCode}</p>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-900">{instance.title}</p>
        </div>
      ) : (
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Record result</p>
      )}

      <div
        className="space-y-3"
        data-result-composer=""
        data-composer-status={initialStatus ?? activeStatus.canonicalStatus}
        data-staged-attachment-count={stagedFiles.length}
      >
        <div role="group" aria-label="Result status">
          <StatusPicker
            options={statusOptions}
            selectedId={activeStatus.id}
            disableUntested={disableUntested}
            onSelect={setSelectedStatus}
          />
        </div>
        <UntestedPolicyHint visible={disableUntested} />
        <ResultCorrectionPolicyHint hasHistory={hasResultHistory} />

        <FormField label="Comment">
          {(control) => (
            <CommentComposer
              id={control.id}
              projectId={projectId}
              value={comment}
              onChange={setComment}
              rows={3}
              placeholder="Add a short note for this result"
              disabled={isSubmitting}
              textareaClassName="min-h-20 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
            />
          )}
        </FormField>

        <FormField label="Actual result">
          {(control) => (
            <textarea
              {...control}
              rows={3}
              disabled={isSubmitting}
              value={actualResult}
              placeholder="What actually happened"
              className="min-h-20 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
              onChange={(e) => setActualResult(e.target.value)}
            />
          )}
        </FormField>

        <FormField label="Defects" helpText="Issue keys are saved with this result.">
          {(control) => <DefectKeyInput id={control.id} projectId={projectId} defects={defects} onChange={setDefects} />}
        </FormField>

        <FormField
          label="Attachments"
          helpText="Queued files attach after the result is saved. History is for reviewing or adding more later."
        >
          {(control) => (
            <div className="space-y-2">
              <input
                {...control}
                type="file"
                multiple
                disabled={isSubmitting}
                data-composer-attachment-input=""
                className="w-full min-w-0 rounded border border-slate-300 px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
                onChange={(e) => {
                  setStagedFiles((current) => mergeStagedComposerFiles(current, Array.from(e.target.files ?? [])));
                  e.target.value = "";
                }}
              />
              {visibleStagedFiles.length === 0 ? (
                <p className="text-xs text-slate-500">No files staged.</p>
              ) : (
                <ul className="space-y-2" aria-label="Staged attachments">
                  {visibleStagedFiles.map((item) => (
                    <li
                      key={item.id}
                      className="min-w-0 space-y-0.5 rounded border border-slate-200 px-2 py-1.5"
                      data-staged-attachment=""
                      data-staged-attachment-status={item.status}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-800">{item.file.name}</p>
                          {item.status === "failed" ? (
                            <SaveFeedback
                              status="failed"
                              message={item.message ?? "Couldn't attach file"}
                              onRetry={onRetryStagedAttachment ? () => onRetryStagedAttachment(item.id) : undefined}
                            />
                          ) : (
                            <p
                              className={`text-[11px] leading-4 ${
                                item.status === "uploaded" ? "text-emerald-700" : "text-slate-500"
                              }`}
                              role={item.status === "uploading" ? "status" : undefined}
                              aria-live={item.status === "uploading" ? "polite" : undefined}
                            >
                              {stagedComposerStatusLabel(item.status, item.progress)}
                            </p>
                          )}
                        </div>
                        {canRemoveStagedComposerFile(item.status) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isSubmitting && item.status !== "failed"}
                            aria-label={`Remove ${item.file.name}`}
                            onClick={() => setStagedFiles((current) => current.filter((row) => row.id !== item.id))}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {item.status === "uploading" && item.progress != null && item.progress > 0 ? (
                        <div className="h-1 overflow-hidden rounded bg-slate-200" aria-hidden="true">
                          <div
                            className="h-full bg-slate-600 transition-all"
                            style={{ width: `${Math.min(100, item.progress)}%` }}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </FormField>

        {showAiEvaluation ? (
          <AiEvaluationResultFields
            expectedOutput={aiEvaluation?.expectedOutput}
            actualOutput={aiActualOutput}
            qualityRating={aiQualityRating}
            latencyMs={aiLatencyMs}
            traces={aiTraces}
            onActualOutputChange={setAiActualOutput}
            onQualityRatingChange={setAiQualityRating}
            onLatencyMsChange={setAiLatencyMs}
            onTracesChange={setAiTraces}
          />
        ) : null}

        <div className="space-y-1 border-t border-slate-100 pt-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Saving..." : hasResultHistory ? "Add result" : "Save result"}
            </Button>
            <Button type="button" variant="secondary" disabled={isSubmitting} onClick={handleCancel}>
              Cancel
            </Button>
          </div>
          {saveFeedback && saveFeedback.status !== "idle" ? (
            <SaveFeedback
              status={saveFeedback.status}
              message={saveFeedback.message}
              onRetry={saveFeedback.status === "failed" ? onRetrySave ?? (() => void handleSubmit()) : undefined}
              onUndo={saveFeedback.status === "saved" && saveFeedback.canUndo ? onUndoSave : undefined}
            />
          ) : null}
        </div>

        <details className="group border-t border-slate-100 pt-2" open={showDetails} onToggle={(event) => setShowDetails(event.currentTarget.open)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-slate-700">
            <span>More fields{detailsCount > 0 ? ` (${detailsCount})` : ""}</span>
            <span className="text-slate-400 group-open:hidden">Show</span>
            <span className="hidden text-slate-400 group-open:inline">Hide</span>
          </summary>
          <div className="mt-3 space-y-3">
            <ElapsedTimerField
              elapsed={elapsed}
              elapsedError={elapsedError}
              isRunning={isElapsedTimerRunning}
              onBlur={() => {
                const normalized = normalizeElapsedInput(elapsed);
                setElapsedError(normalized.error ?? "");
                if (normalized.value) {
                  setElapsed(normalized.value);
                  setElapsedBaseSeconds(normalized.seconds ?? 0);
                }
              }}
              onChange={(value) => {
                setElapsed(value);
                if (elapsedError) setElapsedError("");
              }}
              onReset={resetElapsedTimer}
              onStart={startElapsedTimer}
              onStop={stopElapsedTimer}
            />
            <FormField label="Version">
              {(control) => (
                <input
                  {...control}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                  placeholder="Build or release version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              )}
            </FormField>
            <ResultCustomFields
              fields={activeResultFields}
              values={customValues}
              errors={customValueErrors}
              onChange={setCustomValues}
              onClearError={(systemName) => setCustomValueErrors((current) => ({ ...current, [systemName]: "" }))}
            />
          </div>
        </details>

        <StepResultEditor
          projectId={projectId}
          caseSteps={caseSteps}
          isCaseStepsLoading={isCaseStepsLoading}
          stepResults={stepResults}
          onChange={setStepResults}
        />

        <ScenarioResultEditor
          projectId={projectId}
          scenarios={caseScenarios}
          value={scenarioResults}
          onChange={setScenarioResults}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}
