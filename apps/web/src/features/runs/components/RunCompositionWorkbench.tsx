import type { FormEvent, ReactNode } from "react";

import type { SectionNode } from "../../cases/types";
import { contentHeaderPrimaryClass } from "../../projects/content-header/contentHeaderStyles";
import type { RunCompositionMode } from "../types";
import type { RunCompositionCaseRow } from "./RunCompositionCaseTable";
import { RunCompositionCaseTable } from "./RunCompositionCaseTable";
import { RunCompositionSectionTree } from "./RunCompositionSectionTree";

type SuiteOption = { id: string; name: string };
type MilestoneOption = { id: string | number; name: string };

export type RunCompositionWorkbenchProps = {
  projectId: string;
  name: string;
  onNameChange: (value: string) => void;
  suiteId: string;
  suites: SuiteOption[];
  onSuiteChange: (suiteId: string) => void;
  milestoneId: string;
  milestones: MilestoneOption[];
  onMilestoneChange: (id: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  environment: string;
  onEnvironmentChange: (value: string) => void;
  compositionMode: RunCompositionMode;
  onCompositionModeChange: (mode: RunCompositionMode) => void;
  includeAll: boolean;
  onIncludeAllChange: (value: boolean) => void;
  filterPriority: "" | "low" | "medium" | "high";
  onFilterPriorityChange: (value: "" | "low" | "medium" | "high") => void;
  filterState: "active" | "archived";
  onFilterStateChange: (value: "active" | "archived") => void;
  sections: SectionNode[];
  sectionsLoading: boolean;
  selectedSectionId: number | null;
  onSelectSection: (id: number | null) => void;
  includedSectionIds: string[];
  excludedSectionIds: string[];
  onToggleIncludeSection: (sectionId: string, checked: boolean) => void;
  onToggleExcludeSection: (sectionId: string, checked: boolean) => void;
  subtreeCaseCountBySectionId: Map<number, number>;
  cases: RunCompositionCaseRow[];
  visibleCaseIds: Set<string>;
  selectedCaseIds: string[];
  excludedCaseIds: string[];
  onSelectedCaseIdsChange: (ids: string[]) => void;
  onExcludedCaseIdsChange: (ids: string[]) => void;
  includedScopedCaseIds: Set<string>;
  runScopeSummary: string;
  selectionValidationMessage: string | null;
  sectionFilterNotice: string | null;
  isSubmitDisabled: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
  errorSlot?: ReactNode;
};

export function RunCompositionWorkbench(props: RunCompositionWorkbenchProps) {
  const effectiveIncludeAll = props.compositionMode === "include_all_live" ? true : props.includeAll;

  return (
    <form onSubmit={props.onSubmit} className="flex min-h-[calc(100vh-8rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New test run</h2>
          <p className="text-sm text-slate-500">Choose suite scope, cases, and schedule — then create the run.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={props.isSubmitDisabled}
            className={`${contentHeaderPrimaryClass} disabled:opacity-50`}
          >
            {props.isPending ? "Creating…" : "Create run"}
          </button>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 xl:col-span-2">
            Run name
            <input
              value={props.name}
              onChange={(e) => props.onNameChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              placeholder="e.g. Smoke — nightly"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Suite
            <select
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={props.suiteId}
              onChange={(e) => props.onSuiteChange(e.target.value)}
            >
              <option value="">Select suite</option>
              {props.suites.map((suite) => (
                <option key={suite.id} value={String(suite.id)}>
                  {suite.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Milestone
            <select
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={props.milestoneId}
              onChange={(e) => props.onMilestoneChange(e.target.value)}
            >
              <option value="">None</option>
              {props.milestones.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Start
            <input
              type="date"
              value={props.startDate}
              onChange={(e) => props.onStartDateChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Due
            <input
              type="date"
              value={props.endDate}
              onChange={(e) => props.onEndDateChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 lg:col-span-2">
            Environment
            <input
              value={props.environment}
              onChange={(e) => props.onEnvironmentChange(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              placeholder="e.g. staging"
            />
          </label>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Composition</span>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="compositionMode"
              checked={props.compositionMode === "static"}
              onChange={() => props.onCompositionModeChange("static")}
            />
            Static selection
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="compositionMode"
              checked={props.compositionMode === "include_all_live"}
              onChange={() => {
                props.onCompositionModeChange("include_all_live");
                props.onIncludeAllChange(true);
              }}
            />
            Include all (live sync)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="compositionMode"
              checked={props.compositionMode === "dynamic_filter"}
              onChange={() => props.onCompositionModeChange("dynamic_filter")}
            />
            Dynamic filter
          </label>
          {props.compositionMode === "static" ? (
            <label className="flex items-center gap-1.5 border-l border-slate-200 pl-4 dark:border-slate-700">
              <input
                type="checkbox"
                checked={props.includeAll}
                onChange={(e) => props.onIncludeAllChange(e.target.checked)}
              />
              Include all cases in suite
            </label>
          ) : null}
          {props.compositionMode === "dynamic_filter" ? (
            <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-4 text-xs dark:border-slate-700">
              <select
                value={props.filterPriority}
                onChange={(e) =>
                  props.onFilterPriorityChange(e.target.value as typeof props.filterPriority)
                }
                className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">Any priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                value={props.filterState}
                onChange={(e) => props.onFilterStateChange(e.target.value as "active" | "archived")}
                className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="active">Active cases</option>
                <option value="archived">Archived cases</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {props.suiteId ? (
          <>
            <div className="w-full shrink-0 lg:w-64 xl:w-72">
              {props.sectionsLoading ? (
                <p className="p-4 text-xs text-slate-500">Loading sections…</p>
              ) : (
                <RunCompositionSectionTree
                  sections={props.sections}
                  selectedSectionId={props.selectedSectionId}
                  onSelectSection={props.onSelectSection}
                  includedSectionIds={props.includedSectionIds}
                  excludedSectionIds={props.excludedSectionIds}
                  subtreeCaseCountBySectionId={props.subtreeCaseCountBySectionId}
                  includeAll={effectiveIncludeAll}
                  onToggleInclude={props.onToggleIncludeSection}
                  onToggleExclude={props.onToggleExcludeSection}
                />
              )}
            </div>
            <div className="min-h-[20rem] min-w-0 flex-1 border-t border-slate-200 lg:border-t-0 dark:border-slate-700">
              <RunCompositionCaseTable
                cases={props.cases}
                visibleCaseIds={props.visibleCaseIds}
                selectedCaseIds={props.selectedCaseIds}
                excludedCaseIds={props.excludedCaseIds}
                includeAll={effectiveIncludeAll}
                compositionMode={props.compositionMode}
                filterPriority={props.filterPriority}
                filterState={props.filterState}
                includedSectionIds={props.includedSectionIds}
                includedScopedCaseIds={props.includedScopedCaseIds}
                onSelectedCaseIdsChange={props.onSelectedCaseIdsChange}
                onExcludedCaseIdsChange={props.onExcludedCaseIdsChange}
              />
            </div>
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
            Select a suite to open the section tree and case table.
          </p>
        )}

        <aside className="w-full shrink-0 border-t border-slate-200 bg-slate-50 p-4 text-sm lg:w-64 lg:border-l lg:border-t-0 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope summary</p>
          <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{props.runScopeSummary}</p>
          {props.sectionFilterNotice ? (
            <p className="mt-2 text-xs text-amber-700" role="status">
              {props.sectionFilterNotice}
            </p>
          ) : null}
          {props.selectionValidationMessage ? (
            <p className="mt-2 text-xs text-amber-700">{props.selectionValidationMessage}</p>
          ) : null}
          {props.compositionMode === "static" && !effectiveIncludeAll ? (
            <p className="mt-3 text-[11px] text-slate-500">
              Use <strong>Set to filter</strong> to replace the selection with cases matching priority/state and
              included sections. <strong>Add</strong> / <strong>Remove</strong> merge or subtract that set.
            </p>
          ) : null}
          {props.errorSlot}
        </aside>
      </div>
    </form>
  );
}
