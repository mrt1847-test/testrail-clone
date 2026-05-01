import type { CaseStepContext, StepResultDraft } from "./resultEntryTypes";

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

export function formatElapsed(totalSeconds: number): string {
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

function parseElapsedSeconds(value: string): { seconds?: number; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return { seconds: Number(trimmed) * 60 };
  }

  const colonParts = trimmed.split(":");
  if (colonParts.length === 2 || colonParts.length === 3) {
    const numbers = colonParts.map((part) => Number(part));
    if (numbers.every((part) => Number.isInteger(part) && part >= 0)) {
      const [hours, minutes, seconds] = colonParts.length === 3 ? numbers : [0, numbers[0], numbers[1]];
      if (minutes < 60 && seconds < 60) return { seconds: hours * 3600 + minutes * 60 + seconds };
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
  return { seconds: totalSeconds };
}

export function normalizeElapsedInput(value: string): { value?: string; seconds?: number; error?: string } {
  const parsed = parseElapsedSeconds(value);
  if (parsed.error || parsed.seconds === undefined) return parsed;
  return { value: formatElapsed(parsed.seconds), seconds: parsed.seconds };
}

export function runningElapsedSeconds(baseSeconds: number, startedAt: number | null) {
  if (!startedAt) return baseSeconds;
  return baseSeconds + Math.floor((Date.now() - startedAt) / 1000);
}

export function splitDefectKeys(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function createStepDraft(stepOrder: number): StepResultDraft {
  return {
    id: crypto.randomUUID(),
    stepOrder,
    status: "passed",
    actualResult: "",
    comment: ""
  };
}

export function createStepDraftsFromCaseSteps(caseSteps: CaseStepContext[]): StepResultDraft[] {
  if (caseSteps.length === 0) return [createStepDraft(1)];
  return caseSteps.map((step, index) => createStepDraft(step.stepOrder ?? index + 1));
}

export function isBlankDefaultStepDrafts(stepResults: StepResultDraft[]) {
  return (
    stepResults.length === 1 &&
    stepResults[0]?.stepOrder === 1 &&
    stepResults[0]?.status === "passed" &&
    stepResults[0]?.actualResult === "" &&
    stepResults[0]?.comment === ""
  );
}
