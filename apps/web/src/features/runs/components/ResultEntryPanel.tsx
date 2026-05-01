import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCustomFields } from "../../projects/api/settingsApi";
import { DefectKeyInput } from "./DefectKeyInput";
import { ElapsedTimerField } from "./ElapsedTimerField";
import {
  ResultCustomFields,
  validateCustomFieldValues,
  valueForSubmit
} from "./ResultCustomFields";
import { StepResultEditor } from "./StepResultEditor";
import type { CaseStepContext, ResultStatus, ResultSubmitPayload, StepResultDraft } from "./resultEntryTypes";
import {
  createStepDraftsFromCaseSteps,
  formatElapsed,
  isBlankDefaultStepDrafts,
  normalizeElapsedInput,
  runningElapsedSeconds
} from "./resultEntryUtils";

export type { ResultStatus, ResultSubmitPayload } from "./resultEntryTypes";

type ResultEntryPanelProps = {
  projectId: string;
  instance: { id: string; caseId?: string; caseCode: string; title: string };
  caseSteps?: CaseStepContext[];
  isCaseStepsLoading?: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: ResultSubmitPayload) => void;
};

export function ResultEntryPanel({
  projectId,
  instance,
  caseSteps = [],
  isCaseStepsLoading = false,
  isSubmitting,
  onSubmit
}: ResultEntryPanelProps) {
  const [nextStatus, setNextStatus] = useState<ResultStatus>("passed");
  const [comment, setComment] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [elapsedError, setElapsedError] = useState("");
  const [elapsedBaseSeconds, setElapsedBaseSeconds] = useState(0);
  const [elapsedStartedAt, setElapsedStartedAt] = useState<number | null>(null);
  const [version, setVersion] = useState("");
  const [defects, setDefects] = useState<string[]>([]);
  const [customValueErrors, setCustomValueErrors] = useState<Record<string, string>>({});
  const [stepResults, setStepResults] = useState<StepResultDraft[]>(() => createStepDraftsFromCaseSteps(caseSteps));
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const { data: resultFields = [] } = useQuery({
    queryKey: ["custom-fields", projectId, "result"],
    queryFn: () => fetchCustomFields(projectId, "result"),
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

  function handleSubmit() {
    const elapsedForSubmit = isElapsedTimerRunning ? formatElapsed(runningElapsedSeconds(elapsedBaseSeconds, elapsedStartedAt)) : elapsed;
    const normalizedElapsed = normalizeElapsedInput(elapsedForSubmit);
    setElapsedError(normalizedElapsed.error ?? "");
    if (normalizedElapsed.error || !validateCustomValues()) return;

    const submittedCustomValues = Object.fromEntries(
      activeResultFields.map((field) => [field.systemName, valueForSubmit(field, customValues[field.systemName] ?? "")])
    );
    onSubmit({
      status: nextStatus,
      comment: comment.trim() || undefined,
      elapsed: normalizedElapsed.value,
      version: version.trim() || undefined,
      defects,
      customValues: submittedCustomValues,
      stepResults: stepResults.map((step, index) => ({
        stepOrder: Number.isInteger(step.stepOrder) && step.stepOrder > 0 ? step.stepOrder : index + 1,
        status: step.status,
        actualResult: step.actualResult.trim() || undefined,
        comment: step.comment.trim() || undefined
      }))
    });
    setComment("");
    setElapsed("");
    setElapsedError("");
    setElapsedBaseSeconds(0);
    setElapsedStartedAt(null);
    setVersion("");
    setDefects([]);
    setStepResults(createStepDraftsFromCaseSteps(caseSteps));
    setCustomValues({});
    setCustomValueErrors({});
  }

  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>
        <span className="font-mono text-xs">{instance.caseCode}</span> - {instance.title}
      </p>
      <div className="rounded border border-slate-200 p-2">
        <p className="text-xs font-medium text-slate-700">Submit result</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as ResultStatus)}
          >
            <option value="passed">passed</option>
            <option value="failed">failed</option>
            <option value="blocked">blocked</option>
            <option value="retest">retest</option>
            <option value="untested">untested</option>
          </select>
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs sm:min-w-[120px]"
            placeholder="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
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
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-28"
            placeholder="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <DefectKeyInput defects={defects} onChange={setDefects} />
          <button
            type="button"
            className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
        <ResultCustomFields
          fields={activeResultFields}
          values={customValues}
          errors={customValueErrors}
          onChange={setCustomValues}
          onClearError={(systemName) => setCustomValueErrors((current) => ({ ...current, [systemName]: "" }))}
        />
        <StepResultEditor
          caseSteps={caseSteps}
          isCaseStepsLoading={isCaseStepsLoading}
          stepResults={stepResults}
          onChange={setStepResults}
        />
      </div>
    </div>
  );
}
