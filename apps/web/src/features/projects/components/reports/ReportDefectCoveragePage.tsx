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
  linkedCaseCount: number;
  atRiskResultCount: number;
  linkedDefectCount: number;
  defectKeys: string[];
  defectCoverage: string;
};

export function ReportDefectCoveragePage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.defectCoverage(projectId),
    queryFn: async (): Promise<Row[]> => {
      const res = await apiFetch<Ok<{ items: Row[] }>>(`/api/projects/${projectId}/reports/defect-coverage`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (riskFilter === "at_risk" && row.atRiskResultCount === 0) return false;
      if (riskFilter === "with_defects" && row.linkedDefectCount === 0) return false;
      if (!needle) return true;
      const haystack = `${row.requirementKey} ${row.requirementTitle} ${row.defectKeys.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search, riskFilter]);

  const summaryItems = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const atRisk = filteredRows.reduce((acc, r) => acc + r.atRiskResultCount, 0);
    const defectLinks = filteredRows.reduce((acc, r) => acc + r.linkedDefectCount, 0);
    const withDefects = filteredRows.filter((r) => r.linkedDefectCount > 0).length;
    return [
      { label: "Requirements", value: filteredRows.length, tone: "neutral" as const },
      { label: "At-risk results", value: atRisk, tone: "amber" as const },
      { label: "Defect links", value: defectLinks, tone: "rose" as const },
      { label: "Reqs w/ defects", value: withDefects, tone: "violet" as const }
    ];
  }, [filteredRows]);

  if (q.isLoading) return <LoadingState message="Loading defect coverage…" />;
  if (q.isError) return <ErrorState title="Could not load defect coverage" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Defect coverage"
        description="Defect signals rolled up by requirement for risk review."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Requirement or defect key…"
          },
          {
            kind: "select",
            id: "risk",
            label: "Risk",
            value: riskFilter,
            onChange: setRiskFilter,
            options: [
              { value: "all", label: "All requirements" },
              { value: "at_risk", label: "At-risk only" },
              { value: "with_defects", label: "With defects" }
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
              reportType="defect_coverage"
              filters={{ ui: { search, risk: riskFilter } }}
            />
            <ReportExportButton projectId={projectId} reportType="defect_coverage" disabled={rows.length === 0} />
          </div>
        }
      >
        {filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {rows.length === 0 ? "No requirements." : "No rows match the current filters."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Requirement</th>
                  <th className="py-2 pr-2">At-risk</th>
                  <th className="py-2 pr-2">Defect keys</th>
                  <th className="py-2 pr-2">Link state</th>
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
                    <td className="py-2 pr-2">{row.atRiskResultCount}</td>
                    <td className="py-2 pr-2 text-xs text-slate-600">{row.defectKeys.join(", ") || "—"}</td>
                    <td className="py-2 pr-2">{row.defectCoverage}</td>
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
