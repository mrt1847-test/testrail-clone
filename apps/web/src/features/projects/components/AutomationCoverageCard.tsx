type AutomationCoverageCardProps = {
  pct: number;
};

export function AutomationCoverageCard({ pct }: AutomationCoverageCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Automation coverage</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{pct}%</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
