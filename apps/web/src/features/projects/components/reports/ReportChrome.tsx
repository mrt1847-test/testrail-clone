import type { ReactNode } from "react";

type SummaryTone = "neutral" | "emerald" | "amber" | "rose" | "violet";

const toneCls: Record<SummaryTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900"
};

export type ReportSummaryItem = {
  label: string;
  value: string | number;
  tone?: SummaryTone;
  hint?: string;
};

/** Page title + optional description for report drilldown routes. */
export function ReportPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}

/** Compact KPI strip (filter/summary bar baseline for report pages). */
export function ReportSummaryStrip({ items }: { items: ReportSummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      aria-label="Report summary"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`min-w-[6.5rem] rounded-md border px-2.5 py-1.5 text-xs ${toneCls[item.tone ?? "neutral"]}`}
          title={item.hint}
        >
          <p className="font-medium uppercase tracking-wide opacity-80">{item.label}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Bordered panel wrapping the main table for a report. */
export function ReportTablePanel({ title, toolbar, children }: { title: string; toolbar?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
      </div>
      {children}
    </div>
  );
}
