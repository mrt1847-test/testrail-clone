import { useMemo } from "react";

import type { RunCompositionMode } from "../types";
import {
  applyIdSelectionMode,
  matchCasesByCreateFilter,
  type FilterSelectionMode,
  type RunCreateCaseRow
} from "../utils/runFilterSelection";

export type RunCompositionCaseRow = RunCreateCaseRow & {
  title: string;
  sectionName?: string;
};

type RunCompositionCaseTableProps = {
  cases: RunCompositionCaseRow[];
  visibleCaseIds: Set<string>;
  selectedCaseIds: string[];
  excludedCaseIds: string[];
  includeAll: boolean;
  compositionMode: RunCompositionMode;
  filterPriority: "" | "low" | "medium" | "high";
  filterState: "active" | "archived";
  includedSectionIds: string[];
  includedScopedCaseIds: Set<string>;
  onSelectedCaseIdsChange: (ids: string[]) => void;
  onExcludedCaseIdsChange: (ids: string[]) => void;
};

export function RunCompositionCaseTable({
  cases,
  visibleCaseIds,
  selectedCaseIds,
  excludedCaseIds,
  includeAll,
  compositionMode,
  filterPriority,
  filterState,
  includedSectionIds,
  includedScopedCaseIds,
  onSelectedCaseIdsChange,
  onExcludedCaseIdsChange
}: RunCompositionCaseTableProps) {
  const selectedSet = useMemo(() => new Set(selectedCaseIds), [selectedCaseIds]);
  const visibleRows = useMemo(
    () => cases.filter((row) => visibleCaseIds.has(row.id)),
    [cases, visibleCaseIds]
  );
  const visibleSelectedCount = useMemo(() => {
    let count = 0;
    for (const id of selectedCaseIds) {
      if (visibleCaseIds.has(id)) count += 1;
    }
    return count;
  }, [selectedCaseIds, visibleCaseIds]);

  const applyFilterSelection = (mode: FilterSelectionMode) => {
    const matching = matchCasesByCreateFilter(cases, {
      priority: filterPriority,
      state: filterState,
      includedSectionIds,
      includedScopedCaseIds
    }).filter((id) => visibleCaseIds.has(id));
    onSelectedCaseIdsChange(applyIdSelectionMode(mode, selectedCaseIds, matching));
  };

  const toggleAllVisible = (checked: boolean) => {
    if (includeAll) {
      if (checked) {
        onExcludedCaseIdsChange(excludedCaseIds.filter((id) => !visibleCaseIds.has(id)));
      } else {
        const next = new Set(excludedCaseIds);
        for (const row of visibleRows) next.add(row.id);
        onExcludedCaseIdsChange([...next]);
      }
      return;
    }
    if (checked) {
      const next = new Set(selectedCaseIds);
      for (const row of visibleRows) next.add(row.id);
      onSelectedCaseIdsChange([...next]);
    } else {
      onSelectedCaseIdsChange(selectedCaseIds.filter((id) => !visibleCaseIds.has(id)));
    }
  };

  const allVisibleChecked =
    visibleRows.length > 0 &&
    visibleRows.every((row) =>
      includeAll ? !excludedCaseIds.includes(row.id) : selectedSet.has(row.id)
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Cases</p>
          <p className="text-[11px] text-slate-500">
            {visibleRows.length} visible
            {!includeAll ? ` · ${visibleSelectedCount} selected in view · ${selectedCaseIds.length} total` : ""}
            {includeAll ? ` · ${excludedCaseIds.length} excluded` : ""}
          </p>
        </div>
        {compositionMode === "static" && !includeAll ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              onClick={() => applyFilterSelection("set")}
            >
              Set to filter
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              onClick={() => applyFilterSelection("add")}
            >
              Add filter
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              onClick={() => applyFilterSelection("remove")}
            >
              Remove filter
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-medium uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  aria-label={includeAll ? "Include all visible cases" : "Select all visible cases"}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">Title</th>
              <th className="hidden px-3 py-2 sm:table-cell">Priority</th>
              <th className="hidden px-3 py-2 md:table-cell">Section</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-500">
                  No cases match the current section or filters.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const outOfScope =
                  !includeAll &&
                  includedSectionIds.length > 0 &&
                  row.sectionId &&
                  !includedScopedCaseIds.has(row.id) &&
                  selectedSet.has(row.id);
                const checked = includeAll
                  ? !excludedCaseIds.includes(row.id)
                  : selectedSet.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={outOfScope ? "bg-amber-50/60 dark:bg-amber-950/20" : "hover:bg-slate-50/80"}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (includeAll) {
                            onExcludedCaseIdsChange(
                              e.target.checked
                                ? excludedCaseIds.filter((id) => id !== row.id)
                                : [...excludedCaseIds, row.id]
                            );
                          } else {
                            onSelectedCaseIdsChange(
                              e.target.checked
                                ? [...selectedCaseIds, row.id]
                                : selectedCaseIds.filter((id) => id !== row.id)
                            );
                          }
                        }}
                      />
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {row.title}
                    </td>
                    <td className="hidden px-3 py-2 capitalize text-slate-600 sm:table-cell dark:text-slate-400">
                      {row.priority ?? "—"}
                    </td>
                    <td className="hidden max-w-[10rem] truncate px-3 py-2 text-slate-500 md:table-cell">
                      {row.sectionName ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
