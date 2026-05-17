import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchRefsCoverage } from "../../api/refsReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportFilterBar,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportRefsCoveragePage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.refsCoverage(projectId),
    queryFn: () => fetchRefsCoverage(projectId),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const rows = useMemo(() => {
    const items = report?.items ?? [];
    const needle = search.trim().toLowerCase();
    return items.filter((row) => {
      if (coverageFilter !== "all" && row.coverageStatus !== coverageFilter) return false;
      if (!needle) return true;
      return row.refKey.toLowerCase().includes(needle);
    });
  }, [report?.items, search, coverageFilter]);

  const summaryItems = useMemo(() => {
    if (!report) return [];
    const atRisk = rows.filter((row) => row.coverageStatus === "at_risk").length;
    return [
      { label: "References", value: report.totalReferences, tone: "neutral" as const },
      { label: "Cases w/ refs", value: report.casesWithRefs, tone: "violet" as const },
      { label: "Cases w/o refs", value: report.casesWithoutRefs, tone: "amber" as const },
      { label: "At-risk refs", value: atRisk, tone: "rose" as const }
    ];
  }, [report, rows]);

  if (q.isLoading) return <LoadingState message="Loading references coverage..." />;
  if (q.isError) return <ErrorState title="Could not load references coverage" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="References coverage"
        description="Coverage by case References field (refs), rolled up per reference ID."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Reference ID..."
          },
          {
            kind: "select",
            id: "coverage",
            label: "Coverage",
            value: coverageFilter,
            onChange: setCoverageFilter,
            options: [
              { value: "all", label: "All references" },
              { value: "covered", label: "Covered" },
              { value: "at_risk", label: "At risk" },
              { value: "untested", label: "Untested" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="References"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton projectId={projectId} reportType="refs_coverage" />
            <ReportExportActions
              projectId={projectId}
              reportType="refs_coverage"
              disabled={rows.length === 0}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No references match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Reference</th>
                  <th className="py-2 pr-2">Cases</th>
                  <th className="py-2 pr-2">Coverage</th>
                  <th className="py-2">Latest statuses</th>
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
                    <td className="py-2 pr-2 capitalize">{row.coverageStatus.replace("_", " ")}</td>
                    <td className="py-2 text-xs text-slate-600">{row.latestStatuses.join(", ") || "—"}</td>
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
