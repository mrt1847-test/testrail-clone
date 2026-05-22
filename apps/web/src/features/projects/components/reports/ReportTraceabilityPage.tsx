import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { parseCaseRefs } from "../../../cases/utils/caseRefs";
import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { apiFetch } from "../../../../shared/api/http";
import type { Ok } from "../../../../shared/api/types";
import { reportKeys } from "../../hooks/reportKeys";
import { uiFiltersForReport } from "../../reports/reportExportQuery";
import {
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";
import { ReportToolbar } from "./ReportToolbar";

type RequirementRow = {
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
  caseId: string;
  caseTitle: string;
  caseRefs: string | null;
  runId: string | null;
  runName: string | null;
  testId: string | null;
  latestStatus: string;
  defects: string[];
};

type RefRow = {
  refKey: string;
  caseId: string;
  caseTitle: string;
  caseRefs: string | null;
  runId: string | null;
  runName: string | null;
  testId: string | null;
  latestStatus: string;
  defects: string[];
};

type ViewMode = "requirements" | "references";

function caseListHref(projectId: string, refKey: string) {
  return `/projects/${projectId}/cases?q=${encodeURIComponent(refKey)}`;
}

export function ReportTraceabilityPage() {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view") === "references" ? "references" : "requirements";
  const [view, setView] = useState<ViewMode>(initialView);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? searchParams.get("search") ?? "");
  const [scopeFilter, setScopeFilter] = useState(() => searchParams.get("scope") ?? "all");

  useEffect(() => {
    const next = new URLSearchParams();
    if (view !== "requirements") next.set("view", view);
    if (search.trim().length > 0) next.set("q", search.trim());
    if (scopeFilter !== "all") next.set("scope", scopeFilter);
    setSearchParams(next, { replace: true });
  }, [search, scopeFilter, setSearchParams, view]);

  const requirementQuery = useQuery({
    queryKey: reportKeys.traceability(projectId),
    queryFn: async (): Promise<RequirementRow[]> => {
      const res = await apiFetch<Ok<{ items: RequirementRow[] }>>(`/api/projects/${projectId}/reports/traceability`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId) && view === "requirements"
  });

  const refsQuery = useQuery({
    queryKey: reportKeys.refsTraceability(projectId),
    queryFn: async (): Promise<RefRow[]> => {
      const res = await apiFetch<Ok<{ items: RefRow[] }>>(`/api/projects/${projectId}/reports/refs-traceability`);
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId) && view === "references"
  });

  const activeQuery = view === "requirements" ? requirementQuery : refsQuery;
  const requirementRows = requirementQuery.data ?? [];
  const refRows = refsQuery.data ?? [];

  const filteredRequirementRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requirementRows.filter((row) => {
      if (scopeFilter === "with_run" && row.runId == null) return false;
      if (scopeFilter === "no_run" && row.runId != null) return false;
      if (scopeFilter === "with_defects" && row.defects.length === 0) return false;
      if (!needle) return true;
      const haystack = [
        row.requirementKey,
        row.requirementTitle,
        row.caseTitle,
        row.caseRefs ?? "",
        row.runName ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [requirementRows, search, scopeFilter]);

  const filteredRefRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return refRows.filter((row) => {
      if (scopeFilter === "with_run" && row.runId == null) return false;
      if (scopeFilter === "no_run" && row.runId != null) return false;
      if (scopeFilter === "with_defects" && row.defects.length === 0) return false;
      if (!needle) return true;
      const haystack = [row.refKey, row.caseTitle, row.caseRefs ?? "", row.runName ?? ""].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [refRows, search, scopeFilter]);

  const summaryItems = useMemo(() => {
    if (view === "requirements") {
      if (filteredRequirementRows.length === 0) return [];
      const reqIds = new Set(filteredRequirementRows.map((r) => r.requirementId));
      const caseIds = new Set(filteredRequirementRows.map((r) => r.caseId));
      const withRun = filteredRequirementRows.filter((r) => r.runId != null).length;
      const withDefect = filteredRequirementRows.filter((r) => r.defects.length > 0).length;
      return [
        { label: "Links", value: filteredRequirementRows.length, tone: "neutral" as const, hint: "Requirement × case rows" },
        { label: "Requirements", value: reqIds.size, tone: "violet" as const },
        { label: "Cases", value: caseIds.size, tone: "neutral" as const },
        { label: "With run", value: withRun, tone: "emerald" as const },
        { label: "With defects", value: withDefect, tone: "rose" as const }
      ];
    }
    if (filteredRefRows.length === 0) return [];
    const refKeys = new Set(filteredRefRows.map((r) => r.refKey));
    const caseIds = new Set(filteredRefRows.map((r) => r.caseId));
    const withRun = filteredRefRows.filter((r) => r.runId != null).length;
    return [
      { label: "Ref links", value: filteredRefRows.length, tone: "neutral" as const, hint: "Reference × case rows" },
      { label: "References", value: refKeys.size, tone: "violet" as const },
      { label: "Cases", value: caseIds.size, tone: "neutral" as const },
      { label: "With run", value: withRun, tone: "emerald" as const }
    ];
  }, [view, filteredRequirementRows, filteredRefRows]);

  function switchView(next: ViewMode) {
    setView(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === "references") nextParams.set("view", "references");
    else nextParams.delete("view");
    setSearchParams(nextParams, { replace: true });
  }

  if (activeQuery.isLoading) {
    return <LoadingState message={view === "requirements" ? "Loading traceability…" : "Loading reference traceability…"} />;
  }
  if (activeQuery.isError) {
    return <ErrorState title="Could not load traceability" onRetry={() => void activeQuery.refetch()} />;
  }

  const exportDisabled = view === "requirements" ? requirementRows.length === 0 : refRows.length === 0;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Traceability"
        description={
          view === "requirements"
            ? "Requirement links to cases and the latest execution context (run, status, defects)."
            : "Case reference IDs mapped to cases and their latest execution context."
        }
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchView("requirements")}
          className={[
            "rounded-full px-3 py-1 text-sm font-medium",
            view === "requirements" ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          ].join(" ")}
        >
          Requirements
        </button>
        <button
          type="button"
          onClick={() => switchView("references")}
          className={[
            "rounded-full px-3 py-1 text-sm font-medium",
            view === "references" ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          ].join(" ")}
        >
          Case references
        </button>
      </div>
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: view === "requirements" ? "Requirement, case, or run…" : "Reference, case, or run…"
          },
          {
            kind: "select",
            id: "scope",
            label: "Scope",
            value: scopeFilter,
            onChange: setScopeFilter,
            options: [
              { value: "all", label: "All links" },
              { value: "with_run", label: "With run" },
              { value: "no_run", label: "No run yet" },
              { value: "with_defects", label: "With defects" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Matrix"
        toolbar={
          <ReportToolbar
            projectId={projectId}
            reportType="traceability"
            filters={{ ui: uiFiltersForReport({ q: search, scope: scopeFilter, view }), export: {} }}
            disabled={exportDisabled}
          />
        }
      >
        {view === "requirements" ? (
          <RequirementMatrix
            projectId={projectId}
            rows={filteredRequirementRows}
            totalRows={requirementRows.length}
          />
        ) : (
          <ReferencesMatrix projectId={projectId} rows={filteredRefRows} totalRows={refRows.length} />
        )}
      </ReportTablePanel>
    </div>
  );
}

function RequirementMatrix({
  projectId,
  rows,
  totalRows
}: {
  projectId: string;
  rows: RequirementRow[];
  totalRows: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        {totalRows === 0 ? "No requirement links." : "No rows match the current filters."}
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <th className="py-2 pr-2">Requirement</th>
            <th className="py-2 pr-2">Case</th>
            <th className="py-2 pr-2">Refs</th>
            <th className="py-2 pr-2">Latest run</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2">Defects</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.requirementId}-${row.caseId}`} className="border-b border-slate-100">
              <td className="py-2 pr-2">
                <p className="font-medium text-slate-900">{row.requirementKey}</p>
                <p className="text-xs text-slate-500">{row.requirementTitle}</p>
              </td>
              <td className="py-2 pr-2">
                <Link className="text-indigo-800 hover:underline" to={`/projects/${projectId}/cases?caseId=${row.caseId}`}>
                  {row.caseTitle}
                </Link>
              </td>
              <td className="py-2 pr-2">
                <RefTokenLinks projectId={projectId} refsValue={row.caseRefs} />
              </td>
              <td className="py-2 pr-2">
                {row.runId && row.runName ? (
                  <Link
                    className="text-indigo-800 hover:underline"
                    to={`/projects/${projectId}/runs/${row.runId}${row.testId ? `?testId=${encodeURIComponent(row.testId)}` : ""}`}
                  >
                    {row.runName}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-2 pr-2">{row.latestStatus}</td>
              <td className="py-2 text-xs text-slate-600">{row.defects.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferencesMatrix({
  projectId,
  rows,
  totalRows
}: {
  projectId: string;
  rows: RefRow[];
  totalRows: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        {totalRows === 0 ? "No cases with references." : "No rows match the current filters."}
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <th className="py-2 pr-2">Reference</th>
            <th className="py-2 pr-2">Case</th>
            <th className="py-2 pr-2">Latest run</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2">Defects</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.refKey}-${row.caseId}`} className="border-b border-slate-100">
              <td className="py-2 pr-2">
                <Link className="font-medium text-indigo-800 hover:underline" to={caseListHref(projectId, row.refKey)}>
                  {row.refKey}
                </Link>
              </td>
              <td className="py-2 pr-2">
                <Link className="text-indigo-800 hover:underline" to={`/projects/${projectId}/cases?caseId=${row.caseId}`}>
                  {row.caseTitle}
                </Link>
              </td>
              <td className="py-2 pr-2">
                {row.runId && row.runName ? (
                  <Link
                    className="text-indigo-800 hover:underline"
                    to={`/projects/${projectId}/runs/${row.runId}${row.testId ? `?testId=${encodeURIComponent(row.testId)}` : ""}`}
                  >
                    {row.runName}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-2 pr-2">{row.latestStatus}</td>
              <td className="py-2 text-xs text-slate-600">{row.defects.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefTokenLinks({ projectId, refsValue }: { projectId: string; refsValue: string | null }) {
  const tokens = parseCaseRefs(refsValue);
  if (tokens.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tokens.map((token) => (
        <Link
          key={token}
          to={caseListHref(projectId, token)}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-indigo-800 hover:bg-indigo-50"
        >
          {token}
        </Link>
      ))}
    </span>
  );
}
