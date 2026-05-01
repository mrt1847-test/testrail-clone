import { type KeyboardEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCustomFields, type CustomFieldRow } from "../../projects/api/advancedApi";

export type ResultStatus = "passed" | "failed" | "blocked" | "retest" | "untested";
type CustomValue = string | number | boolean | null;

export type ResultSubmitPayload = {
  status: ResultStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects: string[];
  customValues?: Record<string, CustomValue>;
  stepResults: Array<{ stepOrder: number; status: ResultStatus; comment?: string }>;
};

type ResultEntryPanelProps = {
  projectId: string;
  instance: { id: string; caseCode: string; title: string };
  isSubmitting: boolean;
  onSubmit: (payload: ResultSubmitPayload) => void;
};

const ELAPSED_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  minute: 60,
  minutes: 60,
  h: 60 * 60,
  hr: 60 * 60,
  hour: 60 * 60,
  hours: 60 * 60,
  d: 24 * 60 * 60,
  day: 24 * 60 * 60,
  days: 24 * 60 * 60
};

function formatElapsed(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const units = [
    ["d", 24 * 60 * 60],
    ["h", 60 * 60],
    ["m", 60],
    ["s", 1]
  ] as const;
  const rounded = Math.round(totalSeconds);
  const parts: string[] = [];
  let remaining = rounded;
  for (const [label, seconds] of units) {
    const value = Math.floor(remaining / seconds);
    if (value > 0) {
      parts.push(`${value}${label}`);
      remaining %= seconds;
    }
  }
  return parts.join(" ");
}

function normalizeElapsedInput(value: string): { value?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return { value: formatElapsed(Number(trimmed) * 60) };
  }

  const colonParts = trimmed.split(":");
  if (colonParts.length === 2 || colonParts.length === 3) {
    const numbers = colonParts.map((part) => Number(part));
    if (numbers.every((part) => Number.isInteger(part) && part >= 0)) {
      const [hours, minutes, seconds] = colonParts.length === 3 ? numbers : [0, numbers[0], numbers[1]];
      if (minutes < 60 && seconds < 60) return { value: formatElapsed(hours * 3600 + minutes * 60 + seconds) };
    }
    return { error: "Use hh:mm:ss, mm:ss, or values like 1h 20m." };
  }

  const tokens = [...trimmed.matchAll(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g)];
  const matchedText = tokens.map((match) => match[0]).join("").toLowerCase();
  const compactInput = trimmed.replace(/\s+/g, "").toLowerCase();
  if (tokens.length === 0 || matchedText !== compactInput) {
    return { error: "Use elapsed values like 5m, 1h 20m, 90s, or 01:30." };
  }

  let totalSeconds = 0;
  for (const token of tokens) {
    const unit = token[2].toLowerCase();
    const multiplier = ELAPSED_UNIT_SECONDS[unit];
    if (!multiplier) return { error: "Elapsed units can be d, h, m, or s." };
    totalSeconds += Number(token[1]) * multiplier;
  }
  return { value: formatElapsed(totalSeconds) };
}

function splitDefectKeys(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function valueForSubmit(field: CustomFieldRow, value: string): CustomValue {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (field.fieldType === "number") return Number(trimmed);
  return trimmed;
}

export function ResultEntryPanel({ projectId, instance, isSubmitting, onSubmit }: ResultEntryPanelProps) {
  const [nextStatus, setNextStatus] = useState<ResultStatus>("passed");
  const [comment, setComment] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [elapsedError, setElapsedError] = useState("");
  const [version, setVersion] = useState("");
  const [defectInput, setDefectInput] = useState("");
  const [defects, setDefects] = useState<string[]>([]);
  const [customValueErrors, setCustomValueErrors] = useState<Record<string, string>>({});
  const [step1Status, setStep1Status] = useState<ResultStatus>("passed");
  const [step1Comment, setStep1Comment] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const { data: resultFields = [] } = useQuery({
    queryKey: ["custom-fields", projectId, "result"],
    queryFn: () => fetchCustomFields(projectId, "result"),
    enabled: Boolean(projectId)
  });
  const activeResultFields = resultFields.filter((field) => field.isActive);

  function addDefectsFromInput(value = defectInput) {
    const nextKeys = splitDefectKeys(value);
    if (nextKeys.length === 0) return;
    setDefects((current) => Array.from(new Set([...current, ...nextKeys])));
    setDefectInput("");
  }

  function handleDefectKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (!defectInput.trim()) return;
      event.preventDefault();
      addDefectsFromInput();
    }
    if (event.key === "Backspace" && !defectInput && defects.length > 0) {
      setDefects((current) => current.slice(0, -1));
    }
  }

  function validateCustomValues() {
    const errors: Record<string, string> = {};
    for (const field of activeResultFields) {
      const value = customValues[field.systemName]?.trim() ?? "";
      if (field.isRequired && !value) {
        errors[field.systemName] = `${field.name} is required.`;
      } else if (field.fieldType === "number" && value && !Number.isFinite(Number(value))) {
        errors[field.systemName] = `${field.name} must be a number.`;
      }
    }
    setCustomValueErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    const normalizedElapsed = normalizeElapsedInput(elapsed);
    setElapsedError(normalizedElapsed.error ?? "");
    if (normalizedElapsed.error || !validateCustomValues()) return;

    const submittedCustomValues = Object.fromEntries(
      activeResultFields.map((field) => [field.systemName, valueForSubmit(field, customValues[field.systemName] ?? "")])
    );
    const submittedDefects = Array.from(new Set([...defects, ...splitDefectKeys(defectInput)]));
    onSubmit({
      status: nextStatus,
      comment: comment.trim() || undefined,
      elapsed: normalizedElapsed.value,
      version: version.trim() || undefined,
      defects: submittedDefects,
      customValues: submittedCustomValues,
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
    setElapsedError("");
    setVersion("");
    setDefectInput("");
    setDefects([]);
    setStep1Comment("");
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
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-28"
            placeholder="elapsed"
            value={elapsed}
            onBlur={() => {
              const normalized = normalizeElapsedInput(elapsed);
              setElapsedError(normalized.error ?? "");
              if (normalized.value) setElapsed(normalized.value);
            }}
            onChange={(e) => {
              setElapsed(e.target.value);
              if (elapsedError) setElapsedError("");
            }}
          />
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-28"
            placeholder="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <div className="flex min-h-7 w-full min-w-0 flex-wrap items-center gap-1 rounded border border-slate-300 px-1.5 py-1 sm:w-52">
            {defects.map((defect) => (
              <span key={defect} className="inline-flex max-w-full items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                <span className="truncate">{defect}</span>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-900"
                  aria-label={`Remove ${defect}`}
                  onClick={() => setDefects((current) => current.filter((item) => item !== defect))}
                >
                  x
                </button>
              </span>
            ))}
            <input
              className="min-w-20 flex-1 border-0 p-0 text-xs outline-none"
              placeholder={defects.length > 0 ? "" : "defect key"}
              value={defectInput}
              onBlur={() => addDefectsFromInput()}
              onChange={(e) => setDefectInput(e.target.value)}
              onKeyDown={handleDefectKeyDown}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (splitDefectKeys(pasted).length > 1) {
                  e.preventDefault();
                  addDefectsFromInput(pasted);
                }
              }}
            />
          </div>
          <button
            type="button"
            className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
        {elapsedError ? <p className="mt-1 text-xs text-red-600">{elapsedError}</p> : null}
        {activeResultFields.length > 0 ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {activeResultFields.map((field) => (
              <label key={field.id} className="text-xs text-slate-600">
                <span className="font-medium">
                  {field.name}
                  {field.isRequired ? " *" : ""}
                </span>
                {field.fieldType === "select" ? (
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    value={customValues[field.systemName] ?? ""}
                    onChange={(e) => {
                      setCustomValues((current) => ({ ...current, [field.systemName]: e.target.value }));
                      setCustomValueErrors((current) => ({ ...current, [field.systemName]: "" }));
                    }}
                  >
                    <option value="">Select...</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.fieldType === "number" ? "number" : "text"}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    value={customValues[field.systemName] ?? ""}
                    onChange={(e) => {
                      setCustomValues((current) => ({ ...current, [field.systemName]: e.target.value }));
                      setCustomValueErrors((current) => ({ ...current, [field.systemName]: "" }));
                    }}
                  />
                )}
                {customValueErrors[field.systemName] ? <span className="mt-1 block text-red-600">{customValueErrors[field.systemName]}</span> : null}
              </label>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            value={step1Status}
            onChange={(e) => setStep1Status(e.target.value as ResultStatus)}
          >
            <option value="passed">step 1 - passed</option>
            <option value="failed">step 1 - failed</option>
            <option value="blocked">step 1 - blocked</option>
            <option value="retest">step 1 - retest</option>
            <option value="untested">step 1 - untested</option>
          </select>
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="step 1 comment"
            value={step1Comment}
            onChange={(e) => setStep1Comment(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
