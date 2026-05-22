import { useQuery } from "@tanstack/react-query";

import { fetchRecentDefects, type RecentDefectItem } from "../../projects/api/integrationsApi";

type RecentDefectSuggestionsProps = {
  projectId: string;
  onSelect: (key: string) => void;
  excludeKeys?: string[];
  limit?: number;
  className?: string;
};

export function RecentDefectSuggestions({
  projectId,
  onSelect,
  excludeKeys = [],
  limit = 12,
  className
}: RecentDefectSuggestionsProps) {
  const recentQuery = useQuery({
    queryKey: ["recent-defects", projectId, limit],
    queryFn: () => fetchRecentDefects(projectId, limit),
    enabled: Boolean(projectId),
    staleTime: 30_000
  });

  const items = (recentQuery.data?.items ?? []).filter(
    (item: RecentDefectItem) => !excludeKeys.includes(item.key)
  );

  if (recentQuery.isLoading) {
    return <p className={`text-xs text-slate-500 ${className ?? ""}`.trim()}>Loading recent defects...</p>;
  }

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-xs font-medium text-slate-600">Recent defects</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.url ?? item.key}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-800 hover:border-slate-300 hover:bg-white"
            onClick={() => onSelect(item.key)}
          >
            {item.key}
          </button>
        ))}
      </div>
    </div>
  );
}
