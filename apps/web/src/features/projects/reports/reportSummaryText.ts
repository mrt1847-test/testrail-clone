export type ReportSummaryTone = "neutral" | "emerald" | "amber" | "rose" | "violet";

export type ReportSummaryItem = {
  label: string;
  value: string | number;
  tone?: ReportSummaryTone;
  hint?: string;
};

/** Plain-text KPI strip for clipboard or email. */
export function formatReportSummaryItems(items: ReportSummaryItem[]): string {
  return items
    .map((item) => {
      const line = `${item.label}: ${item.value}`;
      return item.hint ? `${line} (${item.hint})` : line;
    })
    .join("\n");
}

/** Plain-text lines for chart/table-style summary blocks. */
export function formatSummaryLines(lines: string[]): string {
  return lines.filter((line) => line.trim().length > 0).join("\n");
}

/** One line per distribution table row for clipboard copy. */
export function formatDistributionTableLines(
  rows: Array<{ label: string; count: number; percent: number }>
): string[] {
  return rows.map((row) => `${row.label}: ${row.count} (${row.percent}%)`);
}
