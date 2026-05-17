import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchRefsDefectSummary } from "../../api/refsReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportFilterBar,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportRefsDefectSummaryPage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.refsDefectSummary(projectId),
    queryFn: () => fetchRefsDefectSummary(projectId),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const rows = useMemo(() => {
    const items = report?.items ?? [];
    const needle = search.trim().toLowerCase();
    return items.filter((row) => {
      if (coverageFilter !== "all" && row.defectCoverage !== coverageFilter) return false;
      if (!needle) return true;
      return (
        row.refKey.toLowerCase().includes(needle) ||
        row.defectKeys.some((key) => key.toLowerCase().includes(needle))
      );
    });
  }, [report?.items, search, coverageFilter]);

  const summaryItems = useMemo(() => {
    if (!report) return [];
    const atRisk = rows.filter((row) => row.atRiskResultCount > 0).length;
    const unlinked = rows.filter((row) => row.defectCoverage === "unlinked").length;
    const linked = rows.filter((row) => row.defectCoverage === "linked").length;
    return [
      { label: "References", value: report.totalReferences, tone: "neutral" as const },
      { label: "At-risk refs", value: atRisk, tone: "rose" as const },
      { label: "Unlinked", value: unlinked, tone: "amber" as const },
      { label: "Linked", value: linked, tone: "emerald" as const }
    ];
  }, [report, rows]);

  if (q.isLoading) return <LoadingState message="Loading references defect summary..." />;
  if (q.isError) {
    return <ErrorState title="Could not load references defect summary" onRetry={() => void q.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="References defect summary"
        description="Defect linkage rolled up by case References field (refs), for at-risk latest results."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Reference or defect ID..."
          },
          {
            kind: "select",
            id: "coverage",
            label: "Defect coverage",
            value: coverageFilter,
            onChange: setCoverageFilter,
            options: [
              { value: "all", label: "All references" },
              { value: "linked", label: "Linked" },
              { value: "unlinked", label: "Unlinked" },
              { value: "not_applicable", label: "Not applicable" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="References"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton projectId={projectId} reportType="refs_defect_summary" />
            <ReportExportActions
              projectId={projectId}
              reportType="refs_defect_summary"
              disabled={rows.length === 0}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No references match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Reference</th>
                  <th className="py-2 pr-2">Cases</th>
                  <th className="py-2 pr-2">At risk</th>
                  <th className="py-2 pr-2">Defects</th>
                  <th className="py-2 pr-2">Coverage</th>
                  <th className="py-2">Defect keys</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.refKey} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/cases?q=${encodeURIComponent(row.refKey)}`}
                      >
                        {row.refKey}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">{row.linkedCaseCount}</td>
                    <td className="py-2 pr-2">{row.atRiskResultCount}</td>
                    <td className="py-2 pr-2">{row.linkedDefectCount}</td>
                    <td className="py-2 pr-2 capitalize">{row.defectCoverage.replace("_", " ")}</td>
                    <td className="py-2 text-xs text-slate-600">{row.defectKeys.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportTablePanel>
    </div>
  );
}
