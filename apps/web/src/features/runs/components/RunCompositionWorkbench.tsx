import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import type { SectionNode } from "../../cases/types";
import { Button, Dialog, FormField, WorkbenchPage, WorkbenchPageHeader } from "../../../shared/ui";
import type { RunCompositionMode } from "../types";
import { matchCasesByCreateFilter } from "../utils/runFilterSelection";
import {
  filterChooserVisibleCaseIds,
  membershipKindFromComposition,
  runMembershipOptions,
  type RunMembershipKind
} from "../utils/runCreateMembershipModel";
import type { RunCompositionCaseRow } from "./RunCompositionCaseTable";
import { RunCompositionCaseTable } from "./RunCompositionCaseTable";
import { RunCompositionSectionTree } from "./RunCompositionSectionTree";

type SuiteOption = { id: string; name: string };
type MilestoneOption = { id: string | number; name: string };

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900";

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
  onMembershipKindChange: (kind: RunMembershipKind) => void;
  includeAll: boolean;
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
  casesLoading: boolean;
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
  chooserOpen: boolean;
  chooserMode: "select" | "exclude";
  onOpenChooser: (mode: "select" | "exclude") => void;
  onApplyChooser: () => void;
  onCancelChooser: () => void;
  onSelectAllCurrentCases: () => void;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
  errorSlot?: ReactNode;
};

export function RunCompositionWorkbench(props: RunCompositionWorkbenchProps) {
  const kind = membershipKindFromComposition(props.compositionMode, props.includeAll);
  const effectiveIncludeAll = kind === "all";
  const suiteName = props.suites.find((suite) => String(suite.id) === props.suiteId)?.name ?? "";
  const [chooserQuery, setChooserQuery] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(
    Boolean(props.milestoneId || props.startDate || props.endDate || props.environment)
  );

  const chooserVisibleCaseIds = useMemo(
    () => filterChooserVisibleCaseIds(props.cases, props.visibleCaseIds, chooserQuery),
    [chooserQuery, props.cases, props.visibleCaseIds]
  );

  const matchingIds = useMemo(
    () =>
      matchCasesByCreateFilter(props.cases, {
        priority: props.filterPriority,
        state: props.filterState,
        includedSectionIds: props.includedSectionIds,
        includedScopedCaseIds: props.includedScopedCaseIds
      }),
    [props.cases, props.filterPriority, props.filterState, props.includedSectionIds, props.includedScopedCaseIds]
  );
  const matchingTitles = useMemo(() => {
    const allowed = new Set(matchingIds);
    return props.cases.filter((row) => allowed.has(row.id)).slice(0, 5);
  }, [matchingIds, props.cases]);

  const closeChooser = () => {
    setChooserQuery("");
    props.onCancelChooser();
  };

  const applyChooser = () => {
    setChooserQuery("");
    props.onApplyChooser();
  };

  return (
    <form onSubmit={props.onSubmit} className="min-h-0">
      <WorkbenchPage className="mx-auto max-w-2xl gap-3 px-4 py-2">
        <WorkbenchPageHeader
          compact
          title="New test run"
          description="Name the run and choose which tests to include."
          utilityAction={
            <Button type="button" variant="ghost" onClick={props.onCancel}>
              Cancel
            </Button>
          }
        />

        <FormField label="Name" required controlId="run-create-name">
          {(control) => (
            <input
              {...control}
              value={props.name}
              onChange={(e) => props.onNameChange(e.target.value)}
              className={inputClass}
              placeholder="e.g. Smoke — nightly"
            />
          )}
        </FormField>

        <FormField label="Suite" required controlId="run-create-suite">
          {(control) => (
            <select
              {...control}
              className={inputClass}
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
          )}
        </FormField>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Included tests</legend>
          <div role="radiogroup" aria-label="Included tests" className="grid gap-1.5">
            {runMembershipOptions().map((option) => (
              <label
                key={option.kind}
                className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <input
                  type="radio"
                  name="run-membership"
                  className="mt-0.5"
                  checked={kind === option.kind}
                  onChange={() => props.onMembershipKindChange(option.kind)}
                />
                <span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{option.label}</span>
                  <span className="block text-xs text-slate-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === "all" ? (
          <div className="grid gap-2 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              {props.casesLoading
                ? "Counting cases in this suite…"
                : `${props.cases.length} case${props.cases.length === 1 ? "" : "s"} in ${suiteName || "this suite"}. New cases are included automatically.`}
            </p>
            {props.excludedCaseIds.length > 0 || props.excludedSectionIds.length > 0 ? (
              <p className="text-xs text-slate-500">
                {props.excludedCaseIds.length} excluded case{props.excludedCaseIds.length === 1 ? "" : "s"}
                {props.excludedSectionIds.length > 0
                  ? ` · ${props.excludedSectionIds.length} excluded section${props.excludedSectionIds.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            ) : null}
            {props.suiteId ? (
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => props.onOpenChooser("exclude")}>
                  {props.excludedCaseIds.length > 0 || props.excludedSectionIds.length > 0
                    ? "Edit exclusions"
                    : "Exclude cases"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === "selected" ? (
          <div className="grid gap-2 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              {props.selectedCaseIds.length === 0
                ? "No cases selected yet. Membership stays fixed after you create the run."
                : `${props.selectedCaseIds.length} selected. Membership stays fixed.`}
            </p>
            {props.suiteId ? (
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => props.onOpenChooser("select")}>
                  {props.selectedCaseIds.length > 0 ? "Edit cases" : "Select cases"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === "dynamic" ? (
          <div className="grid gap-3 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              Tests in this run will change as matching cases are added or removed from the suite.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Priority" controlId="run-create-filter-priority">
                {(control) => (
                  <select
                    {...control}
                    value={props.filterPriority}
                    onChange={(e) =>
                      props.onFilterPriorityChange(e.target.value as typeof props.filterPriority)
                    }
                    className={inputClass}
                  >
                    <option value="">Any priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                )}
              </FormField>
              <FormField label="State" controlId="run-create-filter-state">
                {(control) => (
                  <select
                    {...control}
                    value={props.filterState}
                    onChange={(e) => props.onFilterStateChange(e.target.value as "active" | "archived")}
                    className={inputClass}
                  >
                    <option value="active">Active cases</option>
                    <option value="archived">Archived cases</option>
                  </select>
                )}
              </FormField>
            </div>
            {props.sections.length > 0 ? (
              <fieldset className="grid gap-1">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Limit to sections
                </legend>
                <p className="text-xs text-slate-500">Leave empty to match the whole suite.</p>
                {props.sections.map((section) => {
                  const sid = String(section.id);
                  return (
                    <label key={section.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={props.includedSectionIds.includes(sid)}
                        onChange={(e) => props.onToggleIncludeSection(sid, e.target.checked)}
                      />
                      {section.name}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
            <p className="text-xs text-slate-500">
              {props.casesLoading
                ? "Previewing matching cases…"
                : `${matchingIds.length} matching${
                    matchingTitles.length > 0
                      ? `: ${matchingTitles.map((row) => row.title).join(", ")}${
                          matchingIds.length > matchingTitles.length ? "…" : ""
                        }`
                      : ""
                  }`}
            </p>
          </div>
        ) : null}

        <div>
          <button
            type="button"
            className="text-sm font-medium text-indigo-800 hover:underline dark:text-indigo-300"
            aria-expanded={scheduleOpen}
            onClick={() => setScheduleOpen((open) => !open)}
          >
            {scheduleOpen ? "Hide schedule and environment" : "Schedule and environment"}
          </button>
          {scheduleOpen ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FormField label="Milestone" controlId="run-create-milestone">
                {(control) => (
                  <select
                    {...control}
                    className={inputClass}
                    value={props.milestoneId}
                    onChange={(e) => props.onMilestoneChange(e.target.value)}
                  >
                    <option value="">None</option>
                    {props.milestones.map((milestone) => (
                      <option key={milestone.id} value={String(milestone.id)}>
                        {milestone.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Environment" controlId="run-create-environment" className="sm:col-span-2">
                {(control) => (
                  <input
                    {...control}
                    value={props.environment}
                    onChange={(e) => props.onEnvironmentChange(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. staging"
                  />
                )}
              </FormField>
              <FormField label="Start" controlId="run-create-start">
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    value={props.startDate}
                    onChange={(e) => props.onStartDateChange(e.target.value)}
                    className={inputClass}
                  />
                )}
              </FormField>
              <FormField label="Due" controlId="run-create-due">
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    value={props.endDate}
                    onChange={(e) => props.onEndDateChange(e.target.value)}
                    className={inputClass}
                  />
                )}
              </FormField>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-1 grid gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-700 dark:text-slate-200">{props.runScopeSummary}</p>
          {props.sectionFilterNotice ? (
            <p className="text-xs text-amber-700" role="status">
              {props.sectionFilterNotice}
            </p>
          ) : null}
          {props.selectionValidationMessage ? (
            <p className="text-xs text-amber-700">{props.selectionValidationMessage}</p>
          ) : null}
          {props.errorSlot}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={props.isSubmitDisabled} loading={props.isPending}>
              Create run
            </Button>
            <Button type="button" variant="ghost" onClick={props.onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </WorkbenchPage>

      <Dialog
        open={props.chooserOpen}
        title={props.chooserMode === "exclude" ? "Exclude cases" : "Select cases"}
        onClose={closeChooser}
        panelClassName="!max-w-4xl"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeChooser}>
              Cancel
            </Button>
            <Button type="button" onClick={applyChooser}>
              Apply
            </Button>
          </div>
        }
      >
        <div className="grid min-h-[20rem] gap-3">
          <FormField label="Search" controlId="run-create-chooser-search">
            {(control) => (
              <input
                {...control}
                value={chooserQuery}
                onChange={(e) => setChooserQuery(e.target.value)}
                className={inputClass}
                placeholder="Filter by title"
              />
            )}
          </FormField>
          {props.chooserMode === "select" ? (
            <div>
              <Button type="button" variant="secondary" size="sm" onClick={props.onSelectAllCurrentCases}>
                Select all current cases
              </Button>
            </div>
          ) : null}
          {props.suiteId ? (
            <div className="flex min-h-[16rem] flex-col overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 lg:flex-row">
              <div className="w-full shrink-0 lg:w-56">
                {props.sectionsLoading ? (
                  <p className="p-3 text-xs text-slate-500">Loading sections…</p>
                ) : (
                  <RunCompositionSectionTree
                    sections={props.sections}
                    selectedSectionId={props.selectedSectionId}
                    onSelectSection={props.onSelectSection}
                    includedSectionIds={props.includedSectionIds}
                    excludedSectionIds={props.excludedSectionIds}
                    subtreeCaseCountBySectionId={props.subtreeCaseCountBySectionId}
                    includeAll={effectiveIncludeAll || props.chooserMode === "exclude"}
                    onToggleInclude={props.onToggleIncludeSection}
                    onToggleExclude={props.onToggleExcludeSection}
                  />
                )}
              </div>
              <div className="min-h-[12rem] min-w-0 flex-1 border-t border-slate-200 lg:border-l lg:border-t-0 dark:border-slate-700">
                <RunCompositionCaseTable
                  cases={props.cases}
                  visibleCaseIds={chooserVisibleCaseIds}
                  selectedCaseIds={props.selectedCaseIds}
                  excludedCaseIds={props.excludedCaseIds}
                  includeAll={effectiveIncludeAll || props.chooserMode === "exclude"}
                  compositionMode={props.compositionMode}
                  filterPriority={props.filterPriority}
                  filterState={props.filterState}
                  includedSectionIds={props.includedSectionIds}
                  includedScopedCaseIds={props.includedScopedCaseIds}
                  onSelectedCaseIdsChange={props.onSelectedCaseIdsChange}
                  onExcludedCaseIdsChange={props.onExcludedCaseIdsChange}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a suite first.</p>
          )}
        </div>
      </Dialog>
    </form>
  );
}
