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
import { useProjectStatuses } from "../hooks/useProjectStatuses";
import type { ProjectStatusOption } from "../utils/projectStatuses";
import { StatusPicker, pickDefaultStatusOption } from "./StatusPicker";
import { UntestedPolicyHint } from "./UntestedPolicyHint";
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
  disableUntested?: boolean;
  onSubmit: (payload: ResultSubmitPayload) => void;
};

export function ResultEntryPanel({
  projectId,
  instance,
  caseSteps = [],
  isCaseStepsLoading = false,
  isSubmitting,
  disableUntested = false,
  onSubmit
}: ResultEntryPanelProps) {
  const statusQuery = useProjectStatuses(projectId);
  const statusOptions = statusQuery.data ?? [];
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusOption | null>(null);
  const activeStatus = selectedStatus ?? pickDefaultStatusOption(statusOptions);
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
  const [showDetails, setShowDetails] = useState(false);

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

  useEffect(() => {
    if (elapsedError || Object.values(customValueErrors).some(Boolean)) setShowDetails(true);
  }, [customValueErrors, elapsedError]);

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
      status: activeStatus.canonicalStatus,
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

  const detailsCount = [elapsed, version, defects.length > 0 ? defects.join(",") : "", activeResultFields.length > 0 ? "fields" : ""].filter(
    Boolean
  ).length;

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div className="min-w-0 border-b border-slate-100 pb-3">
        <p className="font-mono text-xs text-slate-500">{instance.caseCode}</p>
        <p className="mt-1 text-sm font-medium leading-5 text-slate-900">{instance.title}</p>
      </div>

      <div className="space-y-3">
        <StatusPicker
          options={statusOptions}
          selectedId={activeStatus.id}
          disableUntested={disableUntested}
          onSelect={setSelectedStatus}
        />
        <UntestedPolicyHint visible={disableUntested} />

        <label className="block text-xs font-medium text-slate-600">
          Comment
          <textarea
            className="mt-1 min-h-20 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
            placeholder="Add a short note for this result"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>

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
            <label className="block text-xs font-medium text-slate-600">
              Version
              <input
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                placeholder="Build or release version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Defects</p>
              <DefectKeyInput defects={defects} onChange={setDefects} />
            </div>
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
          caseSteps={caseSteps}
          isCaseStepsLoading={isCaseStepsLoading}
          stepResults={stepResults}
          onChange={setStepResults}
        />

        <button
          type="button"
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Saving..." : "Save result"}
        </button>
      </div>
    </div>
  );
}
