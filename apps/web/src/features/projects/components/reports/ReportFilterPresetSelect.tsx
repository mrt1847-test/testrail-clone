import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { fetchSavedReports } from "../../api/savedReportsApi";
import type { ReportExportType } from "../../api/reportsApi";
import { buildReportPageHref } from "../../reports/reportRoutes";

type Props = {
  projectId: string;
  reportType: ReportExportType;
  className?: string;
};

export function ReportFilterPresetSelect({ projectId, reportType, className }: Props) {
  const navigate = useNavigate();
  const savedQuery = useQuery({
    queryKey: ["saved-reports", projectId],
    queryFn: () => fetchSavedReports(projectId),
    enabled: Boolean(projectId)
  });

  const presets = (savedQuery.data ?? []).filter((row) => row.reportType === reportType);
  if (presets.length === 0) return null;

  return (
    <label className={className ?? "flex items-center gap-1.5 text-sm text-slate-700"}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Preset</span>
      <select
        aria-label="Report filter preset"
        defaultValue=""
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          const row = presets.find((p) => p.id === id);
          if (!row) return;
          navigate(buildReportPageHref(projectId, row.reportType, row.filters?.ui ?? {}));
          e.target.value = "";
        }}
      >
        <option value="">Load saved view…</option>
        {presets.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
}
