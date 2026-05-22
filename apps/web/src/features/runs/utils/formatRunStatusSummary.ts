import { RUN_STATUS_SEGMENTS } from "./runProgressSegments";

export function formatRunStatusSummary(counts: Record<string, number>): string {
  const parts: string[] = [];
  for (const segment of RUN_STATUS_SEGMENTS) {
    const value = counts[segment.key] ?? 0;
    if (value > 0) {
      parts.push(`${value} ${segment.label.toLowerCase()}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "No tests in run";
}
