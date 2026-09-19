import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
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
import { isEvidenceRequiringStatus } from "../utils/runSelectedTestState";
import {
  isResultComposerDirty,
  resultAssigneeOptions,
  shouldAssignAfterResult
} from "../utils/resultEntryDialogModel";
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

export type ResultSubmitOptions = {
  advance?: boolean;
};

export type ResultEntryPanelHandle = {
  submit: (advance?: boolean) => Promise<void>;
  isDirty: () => boolean;
};

export type ResultEntryPanelProps = {
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
  variant?: "panel" | "dialog";
  hideFooter?: boolean;
  firstFieldRef?: Ref<HTMLElement>;
  assigneeMembers?: Array<{ userId: string; name: string | null; email: string }>;
  initialAssignedTo?: string | null;
  currentUser?: { id: string; name: string | null; email: string } | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (payload: ResultSubmitPayload, options?: ResultSubmitOptions) => void | Promise<void>;
  onCancel?: () => void;
  saveFeedback?: { status: "idle" | "saving" | "saved" | "failed"; message?: string; canUndo?: boolean } | null;
  onRetrySave?: () => void;
  onUndoSave?: () => void;
  attachmentUploadById?: Record<string, StagedComposerUploadPatch>;
  onRetryStagedAttachment?: (id: string) => void;
  initialStagedAttachments?: Array<{ id: string; file: File }>;
  onDiscardStagedAttachment?: (id: string) => void;
  recoveryResultId?: string | null;
};

export const ResultEntryPanel = forwardRef<ResultEntryPanelHandle, ResultEntryPanelProps>(function ResultEntryPanel(
  {
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
    variant = "panel",
    hideFooter = false,
    firstFieldRef,
    assigneeMembers = [],
    initialAssignedTo = null,
    currentUser = null,
    onDirtyChange,
    onSubmit,
    onCancel,
    saveFeedback = null,
    onRetrySave,
    onUndoSave,
    attachmentUploadById,
    onRetryStagedAttachment,
    initialStagedAttachments = [],
    onDiscardStagedAttachment,
    recoveryResultId = null
  },
  ref
) {
  const statusQuery = useProjectStatuses(projectId);
  const statusOptions = statusQuery.data ?? [];
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusOption | null>(null);
  const activeStatus = selectedStatus ?? pickDefaultStatusOption(statusOptions, initialStatus ?? "passed");
  const [comment, setComment] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [stagedFiles, setStagedFiles] = useState<StagedComposerFile[]>(() =>
    initialStagedAttachments.map((row) => ({ id: row.id, file: row.file, status: "queued" as const }))
  );
  const [elapsed, setElapsed] = useState("");
  const [elapsedError, setElapsedError] = useState("");
  const [elapsedBaseSeconds, setElapsedBaseSeconds] = useState(0);
  const [elapsedStartedAt, setElapsedStartedAt] = useState<number | null>(null);
  const [version, setVersion] = useState("");
  const [defects, setDefects] = useState<string[]>([]);
  const [draftAssignedTo, setDraftAssignedTo] = useState<string | null>(initialAssignedTo);
  const [customValueErrors, setCustomValueErrors] = useState<Record<string, string>>({});
  const [stepResults, setStepResults] = useState<StepResultDraft[]>(() => createStepDraftsFromCaseSteps(caseSteps));
  const [scenarioResults, setScenarioResults] = useState<ScenarioResultDraft[]>(() =>
    createScenarioResultDrafts(caseScenarios)
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [showExtraResultInfo, setShowExtraResultInfo] = useState(false);
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
    setDraftAssignedTo(initialAssignedTo);
  }, [initialAssignedTo, instance.id]);

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

  async function handleSubmit(advance = false) {
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
      await onSubmit(
        {
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
              : undefined,
          assignedTo: variant === "dialog" ? draftAssignedTo : undefined
        },
        { advance }
      );
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
    setDraftAssignedTo(initialAssignedTo);
    setStepResults(createStepDraftsFromCaseSteps(caseSteps));
    setScenarioResults(createScenarioResultDrafts(caseScenarios));
    setCustomValues({});
    setCustomValueErrors({});
    setAiActualOutput("");
    setAiQualityRating("");
    setAiLatencyMs("");
    setAiTraces("");
    setShowDetails(false);
    setShowExtraResultInfo(false);
  }

  useEffect(() => {
    if (saveFeedback?.status === "saved") resetComposerDraft();
  }, [saveFeedback?.status]);

  function handleCancel() {
    resetComposerDraft();
    onCancel?.();
  }

  function removeStagedFile(id: string) {
    setStagedFiles((current) => current.filter((row) => row.id !== id));
    onDiscardStagedAttachment?.(id);
  }

  const isDialog = variant === "dialog";
  const defaultStatus = pickDefaultStatusOption(statusOptions, initialStatus ?? "passed");
  const requiredResultFields = activeResultFields.filter((field) => field.isRequired);
  const optionalResultFields = activeResultFields.filter((field) => !field.isRequired);
  const detailsCount = [elapsed, version, optionalResultFields.length > 0 ? "fields" : ""].filter(Boolean).length;
  const visibleStagedFiles = stagedFiles.map((row) => {
    const overlay = attachmentUploadById?.[row.id];
    return overlay ? { ...row, ...overlay } : row;
  });
  const evidenceRequired = isEvidenceRequiringStatus(activeStatus.canonicalStatus);
  const showEvidenceFields = isDialog
    ? evidenceRequired || showExtraResultInfo || Boolean(actualResult.trim())
    : evidenceRequired || showExtraResultInfo || Boolean(actualResult.trim()) || defects.length > 0;
  const assigneeOptions = resultAssigneeOptions({ members: assigneeMembers, currentUser });
  const stepResultsDirty = useMemo(() => {
    const baseline = createStepDraftsFromCaseSteps(caseSteps);
    if (stepResults.length !== baseline.length) return true;
    return stepResults.some((step, index) => {
      const expected = baseline[index];
      return (
        step.status !== expected?.status ||
        Boolean(step.actualResult.trim()) ||
        Boolean(step.comment.trim()) ||
        step.stepOrder !== expected?.stepOrder
      );
    });
  }, [caseSteps, stepResults]);
  const dirty = isResultComposerDirty({
    statusChanged: activeStatus.canonicalStatus !== defaultStatus.canonicalStatus,
    comment,
    actualResult,
    stagedFileCount: stagedFiles.length,
    elapsed,
    version,
    defects,
    customValues,
    stepResultsDirty,
    scenarioResultsDirty: scenarioResults.some((row) => row.comment.trim() || row.status !== "passed"),
    aiActualOutput,
    assignedToChanged: shouldAssignAfterResult({
      currentAssignedTo: initialAssignedTo,
      draftAssignedTo: isDialog ? draftAssignedTo : undefined
    })
  });

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useImperativeHandle(ref, () => ({
    submit: (advance = false) => handleSubmit(advance),
    isDirty: () => dirty
  }));

  return (
    <div className="space-y-3 text-sm text-slate-700">
      {showInstanceHeader ? (
        <div className="min-w-0 border-b border-slate-100 pb-3">
          <p className="font-mono text-xs text-slate-500">{instance.caseCode}</p>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-900">{instance.title}</p>
        </div>
      ) : isDialog ? null : (
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Record result</p>
      )}

      <div
        className="space-y-3"
        data-result-composer=""
        data-composer-status={initialStatus ?? activeStatus.canonicalStatus}
        data-staged-attachment-count={stagedFiles.length}
        data-result-recovery={recoveryResultId && saveFeedback?.status === "failed" ? "attachment" : undefined}
        data-result-recovery-id={recoveryResultId ?? undefined}
      >
        {isDialog ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-3 sm:col-span-2">
              <FormField label="Status" controlId="result-status">
                {() => (
                  <StatusPicker
                    variant="select"
                    controlId="result-status"
                    options={statusOptions}
                    selectedId={activeStatus.id}
                    disableUntested={disableUntested}
                    disabled={isSubmitting}
                    onSelect={setSelectedStatus}
                    firstFieldRef={firstFieldRef}
                  />
                )}
              </FormField>
              <UntestedPolicyHint visible={disableUntested} />
              {hasResultHistory ? <ResultCorrectionPolicyHint hasHistory /> : null}
              <FormField label="Comment">
                {(control) => (
                  <CommentComposer
                    id={control.id}
                    projectId={projectId}
                    value={comment}
                    onChange={setComment}
                    rows={4}
                    placeholder="Add a short note for this result"
                    disabled={isSubmitting}
                    showTemplates={false}
                    showPreview={false}
                    textareaClassName="min-h-[5.5rem] w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                  />
                )}
              </FormField>
              {showEvidenceFields ? (
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
              ) : (
                <button
                  type="button"
                  className="justify-self-start text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                  onClick={() => setShowExtraResultInfo(true)}
                >
                  More result details
                </button>
              )}
              <FormField label="Attachments">
                {(control) => (
                  <div className="space-y-2">
                    <label className="flex min-h-9 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      <input
                        {...control}
                        type="file"
                        multiple
                        disabled={isSubmitting}
                        data-composer-attachment-input=""
                        className="sr-only"
                        onChange={(e) => {
                          setStagedFiles((current) => mergeStagedComposerFiles(current, Array.from(e.target.files ?? [])));
                          e.target.value = "";
                        }}
                      />
                      Drop files or browse
                    </label>
                    {visibleStagedFiles.length === 0 ? null : (
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
                                  onClick={() => removeStagedFile(item.id)}
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </FormField>
            </div>
            <div className="grid content-start gap-3">
              <FormField label="Assign To" controlId="result-assign-to">
                {(control) => (
                  <select
                    {...control}
                    disabled={isSubmitting}
                    value={draftAssignedTo ?? ""}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                    onChange={(event) => setDraftAssignedTo(event.target.value || null)}
                  >
                    {assigneeOptions.map((option) => (
                      <option key={option.value || "unassigned"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Version">
                {(control) => (
                  <input
                    {...control}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                    placeholder="Build or release"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                )}
              </FormField>
              <ElapsedTimerField
                compact
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
              <FormField label="Defects">
                {(control) => (
                  <DefectKeyInput id={control.id} projectId={projectId} defects={defects} onChange={setDefects} />
                )}
              </FormField>
            </div>
          </div>
        ) : (
          <>
            <div role="group" aria-label="Result status">
              <StatusPicker
                options={statusOptions}
                selectedId={activeStatus.id}
                disableUntested={disableUntested}
                onSelect={setSelectedStatus}
                firstFieldRef={firstFieldRef}
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
          </>
        )}

        {!isDialog ? (
        <>
        {showEvidenceFields ? (
          <>
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
              {(control) => (
                <DefectKeyInput id={control.id} projectId={projectId} defects={defects} onChange={setDefects} />
              )}
            </FormField>
          </>
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
            onClick={() => setShowExtraResultInfo(true)}
          >
            More result details
          </button>
        )}

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
                isDialog ? null : <p className="text-xs text-slate-500">No files staged.</p>
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
                            onClick={() => removeStagedFile(item.id)}
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
        </>
        ) : null}

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

        {hideFooter ? null : (
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
          {!saveFeedback || saveFeedback.status === "idle" ? null : (
            <SaveFeedback
              status={saveFeedback.status}
              message={saveFeedback.message}
              onRetry={saveFeedback.status === "failed" ? onRetrySave ?? (() => void handleSubmit()) : undefined}
              onUndo={saveFeedback.status === "saved" && saveFeedback.canUndo ? onUndoSave : undefined}
            />
          )}
        </div>
        )}

        {isDialog && requiredResultFields.length > 0 ? (
          <ResultCustomFields
            fields={requiredResultFields}
            values={customValues}
            errors={customValueErrors}
            onChange={setCustomValues}
            onClearError={(systemName) => setCustomValueErrors((current) => ({ ...current, [systemName]: "" }))}
          />
        ) : null}

        {isDialog && optionalResultFields.length === 0 ? null : (
        <details className="group border-t border-slate-100 pt-2" open={showDetails} onToggle={(event) => setShowDetails(event.currentTarget.open)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-slate-700">
            <span>{isDialog ? "More fields" : `More fields${detailsCount > 0 ? ` (${detailsCount})` : ""}`}</span>
            <span className="text-slate-400 group-open:hidden">Show</span>
            <span className="hidden text-slate-400 group-open:inline">Hide</span>
          </summary>
          <div className="mt-3 space-y-3">
            {isDialog ? null : (
              <>
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
              </>
            )}
            <ResultCustomFields
              fields={isDialog ? optionalResultFields : activeResultFields}
              values={customValues}
              errors={customValueErrors}
              onChange={setCustomValues}
              onClearError={(systemName) => setCustomValueErrors((current) => ({ ...current, [systemName]: "" }))}
            />
          </div>
        </details>
        )}

        {isDialog && caseSteps.length > 0 ? (
          <details className="border-t border-slate-100 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">Case steps</summary>
            <ol className="mt-2 space-y-2">
              {caseSteps.map((step, index) => (
                <li key={`${step.stepOrder ?? index}-instruction`} className="text-xs text-slate-600">
                  <p className="font-medium text-slate-800">
                    {step.stepOrder ?? index + 1}. {step.description}
                  </p>
                  {step.expected.trim() ? <p className="mt-0.5">Expected: {step.expected}</p> : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {isDialog ? (
          caseSteps.length > 0 || isCaseStepsLoading ? (
          <details className="border-t border-slate-100 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">Step results</summary>
            <div className="mt-2">
              <StepResultEditor
                projectId={projectId}
                caseSteps={caseSteps}
                isCaseStepsLoading={isCaseStepsLoading}
                stepResults={stepResults}
                onChange={setStepResults}
              />
            </div>
          </details>
          ) : null
        ) : (
          <StepResultEditor
            projectId={projectId}
            caseSteps={caseSteps}
            isCaseStepsLoading={isCaseStepsLoading}
            stepResults={stepResults}
            onChange={setStepResults}
          />
        )}

        {isDialog && caseScenarios.length === 0 ? null : isDialog ? (
          <details className="border-t border-slate-100 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">Scenario results</summary>
            <div className="mt-2">
              <ScenarioResultEditor
                projectId={projectId}
                scenarios={caseScenarios}
                value={scenarioResults}
                onChange={setScenarioResults}
                disabled={isSubmitting}
              />
            </div>
          </details>
        ) : (
          <ScenarioResultEditor
            projectId={projectId}
            scenarios={caseScenarios}
            value={scenarioResults}
            onChange={setScenarioResults}
            disabled={isSubmitting}
          />
        )}
      </div>
    </div>
  );
});
