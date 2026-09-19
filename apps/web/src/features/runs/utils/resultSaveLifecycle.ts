import { createdResultId, stagedAttachmentsFromPayload, type StagedComposerUploadPatch } from "./resultComposerModel";
import {
  attachmentRetryFailureMessage,
  canUndoResultSave,
  resultPartialAssignmentFailureMessage,
  resultPartialAttachmentAndAssignmentFailureMessage,
  resultPartialAttachmentFailureMessage,
  resultSaveErrorMessage,
  type ResultSaveAdvanceOptions,
  type ResultSaveFeedback,
  type ResultSaveRetryPayload
} from "./resultSaveFeedback";
import { shouldAssignAfterResult } from "./resultEntryDialogModel";
import type { ResultStatus } from "../components/resultEntryTypes";

export type ResultSaveCall = {
  kind: "create-result" | "associate-attachment" | "assign-test";
  operationId: string;
  testId: string;
  resultId?: string;
  fileId?: string;
  fileName?: string;
  assignedTo?: string | null;
};

export type ResultSaveMode = "attach-only" | "create-result" | "noop-saved" | "assign-only";

export type ResultSaveSnapshot = {
  feedbackByTestId: Record<string, ResultSaveFeedback>;
  uploadByFileId: Record<string, StagedComposerUploadPatch>;
  savingTestIds: string[];
  calls: ResultSaveCall[];
};

export type ResultSaveLifecycleDeps = {
  createResult: (
    input: { testId: string } & Omit<ResultSaveRetryPayload, "attachments" | "stagedAttachments" | "assignedTo">
  ) => Promise<unknown>;
  associateAttachment: (resultId: string, file: File, onProgress?: (progress: number) => void) => Promise<unknown>;
  invalidateAttachments?: (resultId: string) => Promise<void> | void;
  resolvePreviousStatus: (testId: string) => ResultStatus;
  resolveAssignedTo?: (testId: string) => string | null;
  assignTest?: (testId: string, assignedTo: string | null) => Promise<void>;
};

/** Legacy RunDetailPage condition: any failed createdResultId is reused for the next staged submit. */
export function legacyWouldReuseCreatedResult(feedback: {
  status?: string;
  createdResultId?: string | null;
  testId?: string;
} | null | undefined, stagedCount: number): boolean {
  return Boolean(feedback?.status === "failed" && feedback.createdResultId && stagedCount > 0);
}

export function resultFieldsChanged(left: ResultSaveRetryPayload, right: ResultSaveRetryPayload): boolean {
  const pick = (payload: ResultSaveRetryPayload) => ({
    status: payload.status,
    comment: payload.comment ?? "",
    elapsed: payload.elapsed ?? "",
    version: payload.version ?? "",
    defects: payload.defects ?? [],
    customValues: payload.customValues ?? {},
    stepResults: payload.stepResults ?? [],
    scenarioResults: payload.scenarioResults ?? [],
    aiActualOutput: payload.aiActualOutput ?? "",
    aiQualityRating: payload.aiQualityRating ?? null,
    aiLatencyMs: payload.aiLatencyMs ?? null,
    aiTraces: payload.aiTraces ?? ""
  });
  return JSON.stringify(pick(left)) !== JSON.stringify(pick(right));
}

export function remainingStagedAttachments(
  payload: ResultSaveRetryPayload,
  uploadByFileId: Record<string, StagedComposerUploadPatch>,
  discardedFileIds: ReadonlySet<string>
): Array<{ id: string; file: File }> {
  return stagedAttachmentsFromPayload(payload).filter((item) => {
    if (discardedFileIds.has(item.id)) return false;
    return uploadByFileId[item.id]?.status !== "uploaded";
  });
}

export function resolveResultSaveMode(args: {
  feedback?: ResultSaveFeedback | null;
  submittingTestId: string;
  payload: ResultSaveRetryPayload;
  remainingFiles: Array<{ id: string; file: File }>;
}): ResultSaveMode {
  const { feedback, submittingTestId, payload, remainingFiles } = args;
  if (!feedback || feedback.testId !== submittingTestId) return "create-result";
  if (feedback.status !== "failed" || !feedback.createdResultId) return "create-result";
  if (resultFieldsChanged(feedback.retryPayload, payload)) return "create-result";
  if (remainingFiles.length === 0) {
    if (feedback.pendingAssignment !== undefined) return "assign-only";
    return "noop-saved";
  }
  return "attach-only";
}

export function shouldApplyOperationCompletion(currentOperationId: string | undefined, completingOperationId: string): boolean {
  return Boolean(currentOperationId) && currentOperationId === completingOperationId;
}

export function retryPayloadWithoutStagedFile(payload: ResultSaveRetryPayload, fileId: string): ResultSaveRetryPayload {
  const stagedAttachments = (payload.stagedAttachments ?? []).filter((row) => row.id !== fileId);
  const removed = (payload.stagedAttachments ?? []).find((row) => row.id === fileId);
  return {
    ...payload,
    stagedAttachments,
    attachments: removed ? (payload.attachments ?? []).filter((file) => file !== removed.file) : payload.attachments
  };
}

function withoutAttachmentFields(payload: ResultSaveRetryPayload) {
  const {
    attachments: _attachments,
    stagedAttachments: _stagedAttachments,
    assignedTo: _assignedTo,
    ...resultPayload
  } = payload;
  return resultPayload;
}

export function createResultSaveLifecycle(deps: ResultSaveLifecycleDeps) {
  let snapshot: ResultSaveSnapshot = {
    feedbackByTestId: {},
    uploadByFileId: {},
    savingTestIds: [],
    calls: []
  };
  const listeners = new Set<() => void>();
  const inFlight = new Map<string, string>();
  const discardedFileIds = new Set<string>();
  let opSeq = 0;

  function emit(patch: Partial<ResultSaveSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }

  function nextOperationId() {
    opSeq += 1;
    return `result-save-${opSeq}`;
  }

  function setFeedback(testId: string, feedback: ResultSaveFeedback | null) {
    const feedbackByTestId = { ...snapshot.feedbackByTestId };
    if (feedback) feedbackByTestId[testId] = feedback;
    else delete feedbackByTestId[testId];
    emit({ feedbackByTestId });
  }

  function patchUpload(fileId: string, patch: StagedComposerUploadPatch) {
    emit({
      uploadByFileId: { ...snapshot.uploadByFileId, [fileId]: { ...snapshot.uploadByFileId[fileId], ...patch } }
    });
  }

  function setSaving(testId: string, saving: boolean) {
    const savingTestIds = saving
      ? Array.from(new Set([...snapshot.savingTestIds, testId]))
      : snapshot.savingTestIds.filter((id) => id !== testId);
    emit({ savingTestIds });
  }

  function record(call: ResultSaveCall) {
    emit({ calls: [...snapshot.calls, call] });
  }

  async function associateRemaining(
    operationId: string,
    testId: string,
    resultId: string,
    items: Array<{ id: string; file: File }>
  ) {
    const failures: string[] = [];
    for (const item of items) {
      if (discardedFileIds.has(item.id)) continue;
      if (snapshot.uploadByFileId[item.id]?.status === "uploaded") continue;
      patchUpload(item.id, { status: "uploading", progress: 0 });
      record({
        kind: "associate-attachment",
        operationId,
        testId,
        resultId,
        fileId: item.id,
        fileName: item.file.name
      });
      try {
        await deps.associateAttachment(resultId, item.file, (progress) => {
          patchUpload(item.id, { status: "uploading", progress });
        });
        if (discardedFileIds.has(item.id)) continue;
        patchUpload(item.id, { status: "uploaded", progress: 100 });
      } catch (error) {
        patchUpload(item.id, { status: "failed", message: resultSaveErrorMessage(error) });
        failures.push(item.file.name);
      }
    }
    await deps.invalidateAttachments?.(resultId);
    return failures;
  }

  async function applyAssignment(operationId: string, testId: string, payload: ResultSaveRetryPayload) {
    if (
      !shouldAssignAfterResult({
        currentAssignedTo: deps.resolveAssignedTo?.(testId) ?? null,
        draftAssignedTo: payload.assignedTo
      })
    ) {
      return null;
    }
    record({ kind: "assign-test", operationId, testId, assignedTo: payload.assignedTo ?? null });
    if (!deps.assignTest) return resultPartialAssignmentFailureMessage();
    try {
      await deps.assignTest(testId, payload.assignedTo ?? null);
      return null;
    } catch (error) {
      return resultSaveErrorMessage(error);
    }
  }

  function partialFailureMessage(fileFailures: string[], assignmentError: string | null) {
    if (fileFailures.length > 0 && assignmentError) {
      return resultPartialAttachmentAndAssignmentFailureMessage(fileFailures);
    }
    if (assignmentError) return resultPartialAssignmentFailureMessage();
    return resultPartialAttachmentFailureMessage(fileFailures);
  }

  async function submit(testId: string, payload: ResultSaveRetryPayload, options?: ResultSaveAdvanceOptions) {
    if (inFlight.get(testId)) return;
    const ownerFeedback = snapshot.feedbackByTestId[testId];
    const remainingFiles = remainingStagedAttachments(payload, snapshot.uploadByFileId, discardedFileIds);
    const mode = resolveResultSaveMode({
      feedback: ownerFeedback,
      submittingTestId: testId,
      payload,
      remainingFiles
    });
    const operationId = nextOperationId();
    inFlight.set(testId, operationId);
    setSaving(testId, true);

    const previousStatus = ownerFeedback?.previousStatus ?? deps.resolvePreviousStatus(testId);
    const baseFeedback: ResultSaveFeedback = {
      testId,
      status: "saving",
      message: "Saving…",
      previousStatus,
      canUndo: false,
      retryPayload: payload,
      retryAdvance: options,
      createdResultId: ownerFeedback?.createdResultId ?? null,
      pendingAssignment: ownerFeedback?.pendingAssignment,
      operationId,
      kind: mode === "assign-only" ? "assign-only" : mode === "create-result" ? "create-result" : "attach-only"
    };
    setFeedback(testId, baseFeedback);

    try {
      if (mode === "assign-only") {
        const existingId = ownerFeedback?.createdResultId ?? null;
        const assignmentError = await applyAssignment(operationId, testId, payload);
        if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) return;
        if (assignmentError) {
          const failed = {
            ...baseFeedback,
            status: "failed" as const,
            message: resultPartialAssignmentFailureMessage(),
            canUndo: false,
            createdResultId: existingId,
            pendingAssignment: payload.assignedTo,
            kind: "assign-only" as const
          };
          setFeedback(testId, failed);
          throw new Error(failed.message);
        }
        const canUndo = canUndoResultSave(previousStatus);
        setFeedback(testId, {
          ...baseFeedback,
          status: "saved",
          message: "Saved",
          canUndo,
          createdResultId: existingId,
          pendingAssignment: undefined,
          kind: "assign-only"
        });
        return { mode, createdResultId: existingId, advanced: false };
      }

      if (mode === "noop-saved") {
        const assignmentError = await applyAssignment(operationId, testId, payload);
        if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) return;
        if (assignmentError) {
          const failed = {
            ...baseFeedback,
            status: "failed" as const,
            message: resultPartialAssignmentFailureMessage(),
            canUndo: false,
            createdResultId: ownerFeedback?.createdResultId,
            pendingAssignment: payload.assignedTo,
            kind: "assign-only" as const
          };
          setFeedback(testId, failed);
          throw new Error(failed.message);
        }
        const canUndo = canUndoResultSave(previousStatus);
        setFeedback(testId, {
          ...baseFeedback,
          status: "saved",
          message: "Result saved",
          canUndo,
          createdResultId: ownerFeedback?.createdResultId,
          pendingAssignment: undefined,
          kind: "attach-only"
        });
        return { mode, createdResultId: ownerFeedback?.createdResultId ?? null, advanced: false };
      }

      if (mode === "attach-only") {
        const existingId = ownerFeedback!.createdResultId!;
        const failures = await associateRemaining(operationId, testId, existingId, remainingFiles);
        const assignmentError = await applyAssignment(operationId, testId, payload);
        if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) return;
        if (failures.length > 0 || assignmentError) {
          const failed = {
            ...baseFeedback,
            status: "failed" as const,
            message: partialFailureMessage(failures, assignmentError),
            canUndo: false,
            createdResultId: existingId,
            pendingAssignment: assignmentError ? payload.assignedTo : undefined,
            kind: "attach-only" as const
          };
          setFeedback(testId, failed);
          throw new Error(failed.message);
        }
        const canUndo = canUndoResultSave(previousStatus);
        setFeedback(testId, {
          ...baseFeedback,
          status: "saved",
          message: "Saved",
          canUndo,
          createdResultId: existingId,
          pendingAssignment: undefined,
          kind: "attach-only"
        });
        return { mode, createdResultId: existingId, advanced: false };
      }

      const created = await deps.createResult({ testId, ...withoutAttachmentFields(payload) });
      const createdId = createdResultId(created);
      record({ kind: "create-result", operationId, testId, resultId: createdId ?? undefined });
      const failures = createdId ? await associateRemaining(operationId, testId, createdId, remainingFiles) : [];
      const assignmentError = createdId ? await applyAssignment(operationId, testId, payload) : null;
      if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) return;
      if (failures.length > 0 || assignmentError) {
        const failed = {
          ...baseFeedback,
          status: "failed" as const,
          message: partialFailureMessage(failures, assignmentError),
          previousStatus,
          canUndo: false,
          createdResultId: createdId,
          pendingAssignment: assignmentError ? payload.assignedTo : undefined,
          kind: "create-result" as const
        };
        setFeedback(testId, failed);
        throw new Error(failed.message);
      }
      const canUndo = canUndoResultSave(previousStatus);
      setFeedback(testId, {
        ...baseFeedback,
        status: "saved",
        message: "Saved",
        previousStatus,
        canUndo,
        createdResultId: createdId,
        pendingAssignment: undefined,
        kind: "create-result"
      });
      const shouldAdvance = Boolean(options?.advanceToTestId || (options?.advanceOnPass && payload.status === "passed"));
      return { mode, createdResultId: createdId, advanced: shouldAdvance };
    } catch (error) {
      if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) throw error;
      const current = snapshot.feedbackByTestId[testId];
      if (current?.status !== "failed") {
        setFeedback(testId, {
          ...baseFeedback,
          status: "failed",
          message: resultSaveErrorMessage(error),
          canUndo: false,
          createdResultId: current?.createdResultId ?? null,
          kind: "create-result"
        });
      }
      throw error;
    } finally {
      if (inFlight.get(testId) === operationId) inFlight.delete(testId);
      setSaving(testId, false);
    }
  }

  async function retry(testId: string) {
    const current = snapshot.feedbackByTestId[testId];
    if (!current || current.status !== "failed") return;
    return submit(testId, current.retryPayload, current.retryAdvance);
  }

  async function retryAttachment(testId: string, fileId: string) {
    const current = snapshot.feedbackByTestId[testId];
    const resultId = current?.createdResultId;
    if (!current || !resultId) return;
    const item = stagedAttachmentsFromPayload(current.retryPayload).find((row) => row.id === fileId);
    if (!item || discardedFileIds.has(fileId)) return;
    const operationId = nextOperationId();
    inFlight.set(testId, operationId);
    setSaving(testId, true);
    setFeedback(testId, { ...current, status: "saving", message: "Saving…", canUndo: false, operationId, kind: "attach-only" });
    try {
      const failures = await associateRemaining(operationId, testId, resultId, [item]);
      if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) return;
      const unfinished = remainingStagedAttachments(current.retryPayload, snapshot.uploadByFileId, discardedFileIds);
      if (failures.length > 0 || unfinished.length > 0) {
        const names = failures.length > 0 ? failures : unfinished.map((row) => row.file.name);
        setFeedback(testId, {
          ...current,
          status: "failed",
          message: resultPartialAttachmentFailureMessage(names),
          canUndo: false,
          operationId,
          kind: "attach-only"
        });
        return;
      }
      const canUndo = canUndoResultSave(current.previousStatus);
      setFeedback(testId, {
        ...current,
        status: "saved",
        message: "Saved",
        canUndo,
        operationId,
        kind: "attach-only"
      });
    } catch (error) {
      if (!shouldApplyOperationCompletion(inFlight.get(testId), operationId)) return;
      setFeedback(testId, {
        ...current,
        status: "failed",
        message: attachmentRetryFailureMessage([item.file.name]),
        canUndo: false,
        operationId,
        kind: "attach-only"
      });
      throw error;
    } finally {
      if (inFlight.get(testId) === operationId) inFlight.delete(testId);
      setSaving(testId, false);
    }
  }

  function discardStagedFile(testId: string, fileId: string) {
    discardedFileIds.add(fileId);
    const current = snapshot.feedbackByTestId[testId];
    if (!current) return;
    const nextPayload = retryPayloadWithoutStagedFile(current.retryPayload, fileId);
    const remaining = remainingStagedAttachments(nextPayload, snapshot.uploadByFileId, discardedFileIds);
    if (current.createdResultId && remaining.length === 0) {
      const canUndo = canUndoResultSave(current.previousStatus);
      setFeedback(testId, {
        ...current,
        status: "saved",
        message: "Result saved",
        canUndo,
        retryPayload: nextPayload,
        kind: "attach-only"
      });
      return;
    }
    setFeedback(testId, { ...current, retryPayload: nextPayload });
  }

  function expireSaved(testId: string, next: { canUndo?: boolean; clear?: boolean }) {
    const current = snapshot.feedbackByTestId[testId];
    if (!current || current.status !== "saved") return;
    if (next.clear) {
      setFeedback(testId, null);
      return;
    }
    if (next.canUndo === false) setFeedback(testId, { ...current, canUndo: false });
  }

  function cancel(testId: string) {
    const current = snapshot.feedbackByTestId[testId];
    const operationId = nextOperationId();
    inFlight.set(testId, operationId);
    inFlight.delete(testId);
    for (const item of current ? stagedAttachmentsFromPayload(current.retryPayload) : []) {
      discardedFileIds.add(item.id);
    }
    if (current?.createdResultId) {
      const canUndo = canUndoResultSave(current.previousStatus);
      setFeedback(testId, {
        ...current,
        status: "saved",
        message: "Result saved",
        canUndo,
        retryPayload: { ...current.retryPayload, stagedAttachments: [], attachments: [] },
        operationId,
        kind: "attach-only"
      });
      return;
    }
    setFeedback(testId, null);
  }

  function composerRecoveryFiles(testId: string): Array<{ id: string; file: File }> {
    const current = snapshot.feedbackByTestId[testId];
    if (!current || current.status !== "failed") return [];
    return stagedAttachmentsFromPayload(current.retryPayload).filter((item) => !discardedFileIds.has(item.id));
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isSaving: (testId: string) => snapshot.savingTestIds.includes(testId),
    feedbackFor: (testId: string) => snapshot.feedbackByTestId[testId] ?? null,
    composerRecoveryFiles,
    expireSaved,
    submit,
    retry,
    retryAttachment,
    discardStagedFile,
    cancel
  };
}

export type ResultSaveLifecycle = ReturnType<typeof createResultSaveLifecycle>;
