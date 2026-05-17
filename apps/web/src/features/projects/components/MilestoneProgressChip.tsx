type MilestoneProgressChipProps = {
  progress: number;
  runCount?: number;
  childCount?: number;
  includesSubMilestones?: boolean;
  compact?: boolean;
};

export function MilestoneProgressChip({
  progress,
  runCount = 0,
  childCount = 0,
  includesSubMilestones = false,
  compact = false
}: MilestoneProgressChipProps) {
  const hasRuns = runCount > 0;
  const tone =
    progress >= 80 ? "bg-emerald-50 text-emerald-800" : progress >= 40 ? "bg-sky-50 text-sky-800" : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <span>{hasRuns ? `${progress}%` : "No runs"}</span>
      {!compact && childCount > 0 ? (
        <span className="text-[10px] font-normal opacity-80">
          {childCount} sub{childCount === 1 ? "" : "s"}
        </span>
      ) : null}
      {includesSubMilestones ? (
        <span className="rounded bg-white/70 px-1 text-[10px] font-normal uppercase tracking-wide">rollup</span>
      ) : null}
    </span>
  );
}
