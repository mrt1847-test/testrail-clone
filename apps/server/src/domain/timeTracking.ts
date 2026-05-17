const DURATION_UNIT_SECONDS: Record<string, number> = {
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

export function parseDurationToSeconds(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 60);
  }

  const colonParts = trimmed.split(":");
  if (colonParts.length === 2 || colonParts.length === 3) {
    const numbers = colonParts.map((part) => Number(part));
    if (numbers.every((part) => Number.isInteger(part) && part >= 0)) {
      const [hours, minutes, seconds] = colonParts.length === 3 ? numbers : [0, numbers[0], numbers[1]];
      if (minutes < 60 && seconds < 60) return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
  }

  const tokens = [...trimmed.matchAll(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g)];
  const matchedText = tokens.map((match) => match[0]).join("").toLowerCase();
  const compactInput = trimmed.replace(/\s+/g, "").toLowerCase();
  if (tokens.length === 0 || matchedText !== compactInput) return null;

  let totalSeconds = 0;
  for (const token of tokens) {
    const unit = token[2]!.toLowerCase();
    const multiplier = DURATION_UNIT_SECONDS[unit];
    if (!multiplier) return null;
    totalSeconds += Number(token[1]) * multiplier;
  }
  return Math.round(totalSeconds);
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const units = [
    ["d", 24 * 60 * 60],
    ["h", 60 * 60],
    ["m", 60],
    ["s", 1]
  ] as const;
  const parts: string[] = [];
  let remaining = Math.round(totalSeconds);
  for (const [label, seconds] of units) {
    const value = Math.floor(remaining / seconds);
    if (value > 0) {
      parts.push(`${value}${label}`);
      remaining %= seconds;
    }
  }
  return parts.join(" ");
}

export function sumDurationSeconds(values: Array<string | null | undefined>) {
  return values.reduce((total, value) => total + (parseDurationToSeconds(value) ?? 0), 0);
}
