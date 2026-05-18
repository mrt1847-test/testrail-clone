type SuiteEstimatesBubbleProps = {
  totalEstimateDisplay: string | null;
  casesWithEstimateCount: number;
  activeCaseCount: number;
  isLoading?: boolean;
};

export function SuiteEstimatesBubble({
  totalEstimateDisplay,
  casesWithEstimateCount,
  activeCaseCount,
  isLoading = false
}: SuiteEstimatesBubbleProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-500">
        Calculating estimates…
      </div>
    );
  }

  if (!totalEstimateDisplay) {
    return (
      <div
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500"
        title="Add estimates to cases to see a suite forecast"
      >
        No estimate forecast yet.
      </div>
    );
  }

  const coverage =
    activeCaseCount > 0 ? Math.round((casesWithEstimateCount / activeCaseCount) * 100) : 0;

  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 shadow-sm"
      title="Sum of active case estimates in this suite"
    >
      <div className="font-semibold">Forecast: {totalEstimateDisplay}</div>
      <p className="mt-0.5 text-[11px] text-amber-900/80">
        {casesWithEstimateCount} of {activeCaseCount} active case{activeCaseCount === 1 ? "" : "s"} estimated
        {coverage > 0 ? ` (${coverage}%)` : ""}.
      </p>
    </div>
  );
}
