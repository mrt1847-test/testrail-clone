import { useQuery } from "@tanstack/react-query";

import { fetchSharedSteps } from "../api/sharedStepsApi";

type SharedStepAttachSelectProps = {
  projectId: string;
  disabled?: boolean;
  onAttach: (sharedStepId: string) => void;
};

export function SharedStepAttachSelect({ projectId, disabled = false, onAttach }: SharedStepAttachSelectProps) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["shared-steps", projectId, "attach"],
    queryFn: () => fetchSharedSteps(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) {
    return <span className="text-xs text-slate-500">Loading shared steps…</span>;
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <label className="inline-flex items-center gap-1 text-xs text-slate-700">
      <span className="font-medium">Insert shared</span>
      <select
        disabled={disabled}
        defaultValue=""
        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs disabled:opacity-50"
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          onAttach(value);
          event.target.value = "";
        }}
      >
        <option value="">Choose…</option>
        {data.map((row) => (
          <option key={row.id} value={row.id}>
            {row.title} ({row.entries.length})
          </option>
        ))}
      </select>
    </label>
  );
}
