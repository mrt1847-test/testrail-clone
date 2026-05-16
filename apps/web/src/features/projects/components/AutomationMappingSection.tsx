import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  fetchAutomationMappings,
  updateAutomationMapping,
  type AutomationMappingRow
} from "../api/automationApi";

type CoverageFilter = "mapped" | "unmapped";

type Props = {
  projectId: string;
};

export function AutomationMappingSection({ projectId }: Props) {
  const qc = useQueryClient();
  const [coverage, setCoverage] = useState<CoverageFilter>("unmapped");
  const [search, setSearch] = useState("");
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const mappingsQuery = useQuery({
    queryKey: ["automation-mappings", projectId, coverage, search],
    queryFn: () =>
      fetchAutomationMappings(projectId, {
        coverage,
        q: search.trim() || undefined,
        page: 1,
        pageSize: 50
      }),
    enabled: Boolean(projectId)
  });

  const saveMutation = useMutation({
    mutationFn: (input: { caseId: string; automationKey: string }) =>
      updateAutomationMapping(projectId, input.caseId, input.automationKey),
    onSuccess: async () => {
      setSaveError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["automation-mappings", projectId] }),
        qc.invalidateQueries({ queryKey: ["automation-summary", projectId] })
      ]);
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    }
  });

  const rows = mappingsQuery.data?.rows ?? [];
  const editingRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        draftKey: draftKeys[row.caseId] ?? row.automationKey ?? ""
      })),
    [rows, draftKeys]
  );

  const handleSave = async (row: AutomationMappingRow & { draftKey: string }) => {
    const nextKey = row.draftKey.trim();
    if (!nextKey) {
      setSaveError("Automation key is required.");
      return;
    }
    await saveMutation.mutateAsync({ caseId: row.caseId, automationKey: nextKey });
    setDraftKeys((current) => {
      const next = { ...current };
      delete next[row.caseId];
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Case automation mapping</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-slate-600">
            View
            <select
              className="rounded border border-slate-300 px-1 py-0.5"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value as CoverageFilter)}
            >
              <option value="unmapped">Unmapped</option>
              <option value="mapped">Mapped</option>
            </select>
          </label>
          <input
            className="rounded border border-slate-300 px-2 py-0.5"
            placeholder="Search case or key"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Assign a unique automation key so CI payloads can target the correct case. Unmapped cases often cause bulk upload
        failures.
      </p>
      {mappingsQuery.isLoading ? (
        <p className="mt-3 text-sm text-slate-500">Loading mappings…</p>
      ) : mappingsQuery.isError ? (
        <p className="mt-3 text-sm text-rose-600">Could not load mappings.</p>
      ) : editingRows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {coverage === "unmapped" ? "All active cases have automation keys." : "No mapped cases match this filter."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {editingRows.map((row) => (
            <li key={row.caseId} className="rounded border border-slate-200 px-3 py-2 text-sm">
              <p className="font-medium text-slate-900">
                C{row.caseId} · {row.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="min-w-[12rem] flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                  value={row.draftKey}
                  placeholder="e.g. checkout.e2e.login"
                  onChange={(e) =>
                    setDraftKeys((current) => ({
                      ...current,
                      [row.caseId]: e.target.value
                    }))
                  }
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  disabled={saveMutation.isPending}
                  onClick={() => void handleSave(row)}
                >
                  Save mapping
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {saveError ? <p className="mt-2 text-xs text-rose-600">{saveError}</p> : null}
      {mappingsQuery.data && mappingsQuery.data.total > editingRows.length ? (
        <p className="mt-2 text-xs text-slate-500">Showing {editingRows.length} of {mappingsQuery.data.total} cases.</p>
      ) : null}
    </div>
  );
}
