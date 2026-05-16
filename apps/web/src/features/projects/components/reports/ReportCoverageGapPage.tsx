import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { apiFetch } from "../../../../shared/api/http";
import type { Ok } from "../../../../shared/api/types";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportButton,
  ReportSaveViewButton,
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

type Row = {
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
  coverageStatus: string;
  linkedCaseCount: number;
};

export function ReportCoverageGapPage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.coverageGap(projectId),
    queryFn: async (): Promise<Row[]> => {
      const res = await apiFetch<Ok<{ items: Row[] }>>(`/api/projects/${projectId}/reports/coverage-gap`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (coverageFilter === "gaps" && row.linkedCaseCount > 0) return false;
      if (coverageFilter === "covered" && row.linkedCaseCount === 0) return false;
      if (!needle) return true;
      const haystack = `${row.requirementKey} ${row.requirementTitle}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search, coverageFilter]);

  const summaryItems = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const covered = filteredRows.filter((r) => r.linkedCaseCount > 0).length;
    const gaps = filteredRows.length - covered;
    const totalCases = filteredRows.reduce((acc, r) => acc + r.linkedCaseCount, 0);
    return [
      { label: "Requirements", value: filteredRows.length, tone: "neutral" as const },
      { label: "With cases", value: covered, tone: "emerald" as const },
      {
        label: "Gaps",
        value: gaps,
        tone: gaps > 0 ? ("amber" as const) : ("neutral" as const),
        hint: "Requirements with zero linked cases"
      },
      { label: "Linked cases", value: totalCases, tone: "violet" as const }
    ];
  }, [filteredRows]);

  if (q.isLoading) return <LoadingState message="Loading coverage gap…" />;
  if (q.isError) return <ErrorState title="Could not load coverage gap" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Coverage gap"
        description="Requirements versus linked test cases—use this to find missing test coverage."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Requirement key or title…"
          },
          {
            kind: "select",
            id: "coverage",
            label: "Coverage",
            value: coverageFilter,
            onChange: setCoverageFilter,
            options: [
              { value: "all", label: "All requirements" },
              { value: "gaps", label: "Gaps only" },
              { value: "covered", label: "With cases only" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Requirements"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="coverage_gap"
              filters={{ ui: { search, coverage: coverageFilter } }}
            />
            <ReportExportButton projectId={projectId} reportType="coverage_gap" disabled={rows.length === 0} />
          </div>
        }
      >
        {filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {rows.length === 0 ? "No requirements." : "No rows match the current filters."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Requirement</th>
                  <th className="py-2 pr-2">Cases</th>
                  <th className="py-2 pr-2">Coverage</th>
                  <th className="py-2">Traceability</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.requirementId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-900">{row.requirementKey}</p>
                      <p className="text-xs text-slate-500">{row.requirementTitle}</p>
                    </td>
                    <td className="py-2 pr-2">{row.linkedCaseCount}</td>
                    <td className="py-2 pr-2">{row.coverageStatus}</td>
                    <td className="py-2">
                      <Link
                        className="text-xs font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/reports/traceability?q=${encodeURIComponent(row.requirementKey)}`}
                      >
                        Open links
                      </Link>
                    </td>
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
