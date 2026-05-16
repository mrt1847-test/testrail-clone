import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../../../shared/api/http";
import type { Paged } from "../../../shared/api/types";
import { buildValidSectionIdSet } from "../../../shared/sections/sectionCompatibility";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchMilestones } from "../../projects/api/planningApi";
import { dateInputToIso, toDateInputValue } from "../utils/runDates";
import type { RunCompositionMode } from "../types";
import { useRunCompositionDraft } from "../hooks/useRunCompositionDraft";
import { useCreateRunMutation } from "../hooks/useRunsApi";
import {
  applyIdSelectionMode,
  matchCasesByCreateFilter,
  type FilterSelectionMode
} from "../utils/runFilterSelection";

async function fetchAllPagedRows<T>(buildPath: (page: number, pageSize: number) => string, pageSize = 100): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await apiFetch<Paged<T>>(buildPath(page, pageSize));
    out.push(...res.data);
    totalPages = Math.max(1, res.totalPages ?? 1);
    page += 1;
  }
  return out;
}

export function RunCreatePage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [environment, setEnvironment] = useState("");
  const [includeAll, setIncludeAll] = useState(true);
  const [compositionMode, setCompositionMode] = useState<RunCompositionMode>("static");
  const [filterPriority, setFilterPriority] = useState<"" | "low" | "medium" | "high">("");
  const [filterState, setFilterState] = useState<"active" | "archived">("active");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [excludedCaseIds, setExcludedCaseIds] = useState<string[]>([]);
  const [includedSectionIds, setIncludedSectionIds] = useState<string[]>([]);
  const [excludedSectionIds, setExcludedSectionIds] = useState<string[]>([]);
  const [sectionFilterNotice, setSectionFilterNotice] = useState<string | null>(null);
  const suiteHydratedRef = useRef<string | null>(null);
  const mutation = useCreateRunMutation(projectId);
  const suitesQuery = useQuery({
    queryKey: ["run-create-suites", projectId],
    queryFn: async () =>
      fetchAllPagedRows<{ id: string; name: string }>(
        (page, pageSize) => `/api/projects/${projectId}/suites?page=${page}&pageSize=${pageSize}`
      ),
    enabled: Boolean(projectId)
  });
  const casesQuery = useQuery({
    queryKey: ["run-create-cases", projectId, suiteId],
    queryFn: async () =>
      fetchAllPagedRows<{ id: string; title: string; sectionId?: string }>(
        (page, pageSize) =>
          `/api/projects/${projectId}/cases?page=${page}&pageSize=${pageSize}${suiteId ? `&suiteId=${encodeURIComponent(suiteId)}` : ""}`
      ),
    enabled: Boolean(projectId && suiteId)
  });
  const milestonesQuery = useQuery({
    queryKey: ["run-create-milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });
  const sectionsQuery = useQuery({
    queryKey: ["run-create-sections", suiteId],
    queryFn: async () =>
      fetchAllPagedRows<{ id: string; name: string; parentSectionId?: string | null }>(
        (page, pageSize) => `/api/suites/${suiteId}/sections?page=${page}&pageSize=${pageSize}`
      ),
    enabled: Boolean(suiteId)
  });

  const suites = suitesQuery.data ?? [];
  const cases = casesQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];
  const milestones = milestonesQuery.data ?? [];
  const validSectionIds = useMemo(
    () => buildValidSectionIdSet(sections.map((section) => Number(section.id))),
    [sections]
  );
  const { loadDraftForSuite, markHydrated, pruneAgainstValidSections } = useRunCompositionDraft(
    projectId,
    user?.id,
    suiteId,
    includedSectionIds,
    excludedSectionIds,
    validSectionIds
  );

  useEffect(() => {
    if (!milestoneId) return;
    const milestone = milestones.find((item) => String(item.id) === milestoneId);
    if (!milestone) return;
    if (milestone.startDate) setStartDate(toDateInputValue(milestone.startDate));
    if (milestone.dueDate) setEndDate(toDateInputValue(milestone.dueDate));
  }, [milestoneId, milestones]);

  useEffect(() => {
    if (!suiteId) {
      suiteHydratedRef.current = null;
      return;
    }
    if (suiteHydratedRef.current === suiteId) return;
    const draft = loadDraftForSuite(suiteId);
    if (draft) {
      setIncludedSectionIds(draft.includedSectionIds);
      setExcludedSectionIds(draft.excludedSectionIds);
    } else {
      setIncludedSectionIds([]);
      setExcludedSectionIds([]);
    }
    suiteHydratedRef.current = suiteId;
    markHydrated();
  }, [loadDraftForSuite, markHydrated, suiteId]);

  useEffect(() => {
    if (!suiteId || validSectionIds.size === 0) return;
    const pruned = pruneAgainstValidSections(includedSectionIds, excludedSectionIds);
    if (pruned.removedCount === 0) return;
    setIncludedSectionIds(pruned.included);
    setExcludedSectionIds(pruned.excluded);
    if (pruned.message) setSectionFilterNotice(pruned.message);
  }, [
    excludedSectionIds,
    includedSectionIds,
    pruneAgainstValidSections,
    suiteId,
    validSectionIds
  ]);
  const sectionDepth = useMemo(() => {
    const parentById = new Map<string, string | null>();
    for (const section of sections) {
      parentById.set(String(section.id), section.parentSectionId ? String(section.parentSectionId) : null);
    }
    const memo = new Map<string, number>();
    const getDepth = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      const parent = parentById.get(id);
      const depth = parent ? Math.min(6, getDepth(parent) + 1) : 0;
      memo.set(id, depth);
      return depth;
    };
    for (const section of sections) getDepth(String(section.id));
    return memo;
  }, [sections]);
  const descendantIdsBySectionId = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    for (const section of sections) {
      const parent = section.parentSectionId ? String(section.parentSectionId) : "__root__";
      const id = String(section.id);
      const rows = childrenByParent.get(parent) ?? [];
      rows.push(id);
      childrenByParent.set(parent, rows);
    }
    const memo = new Map<string, Set<string>>();
    const walk = (id: string): Set<string> => {
      if (memo.has(id)) return memo.get(id)!;
      const out = new Set<string>([id]);
      const children = childrenByParent.get(id) ?? [];
      for (const childId of children) {
        for (const nestedId of walk(childId)) out.add(nestedId);
      }
      memo.set(id, out);
      return out;
    };
    for (const section of sections) walk(String(section.id));
    return memo;
  }, [sections]);
  const directCaseCountBySectionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of cases) {
      if (!row.sectionId) continue;
      const key = String(row.sectionId);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [cases]);
  const subtreeCaseCountBySectionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const section of sections) {
      const sid = String(section.id);
      let count = 0;
      const descendants = descendantIdsBySectionId.get(sid) ?? new Set<string>([sid]);
      for (const childId of descendants) count += directCaseCountBySectionId.get(childId) ?? 0;
      map.set(sid, count);
    }
    return map;
  }, [descendantIdsBySectionId, directCaseCountBySectionId, sections]);
  const includedSet = useMemo(() => new Set(includedSectionIds), [includedSectionIds]);
  const excludedSet = useMemo(() => new Set(excludedSectionIds), [excludedSectionIds]);
  const selectedCaseIdSet = useMemo(() => new Set(selectedCaseIds), [selectedCaseIds]);
  const includedScopedCaseIds = useMemo(() => {
    if (includedSectionIds.length === 0) return new Set<string>(cases.map((row) => String(row.id)));
    const allowedSectionIds = new Set<string>();
    for (const sid of includedSectionIds) {
      const descendants = descendantIdsBySectionId.get(sid);
      if (!descendants) continue;
      for (const childId of descendants) allowedSectionIds.add(childId);
    }
    const out = new Set<string>();
    for (const row of cases) {
      if (row.sectionId && allowedSectionIds.has(String(row.sectionId))) out.add(String(row.id));
    }
    return out;
  }, [cases, descendantIdsBySectionId, includedSectionIds]);
  const selectedCaseCountInScope = useMemo(() => {
    if (includeAll) return 0;
    let count = 0;
    for (const cid of selectedCaseIds) {
      if (includedScopedCaseIds.has(cid)) count += 1;
    }
    return count;
  }, [includeAll, includedScopedCaseIds, selectedCaseIds]);
  const sectionOverlapCount = useMemo(() => {
    let count = 0;
    for (const sid of includedSet) {
      if (excludedSet.has(sid)) count += 1;
    }
    return count;
  }, [excludedSet, includedSet]);
  const runScopeSummary = useMemo(() => {
    if (includeAll) {
      return `${cases.length} cases in suite · include roots ${includedSectionIds.length} · exclude roots ${excludedSectionIds.length} · excluded cases ${excludedCaseIds.length}`;
    }
    return `${selectedCaseIds.length} selected · ${selectedCaseCountInScope} in section scope`;
  }, [
    cases.length,
    excludedCaseIds.length,
    excludedSectionIds.length,
    includeAll,
    includedSectionIds.length,
    selectedCaseCountInScope,
    selectedCaseIds.length
  ]);
  const selectionValidationMessage = useMemo(() => {
    if (!suiteId) return "Select a suite first.";
    if (!includeAll && selectedCaseIds.length === 0) return "Select at least one case.";
    if (!includeAll && includedSectionIds.length > 0 && selectedCaseCountInScope === 0) {
      return "Selected cases do not intersect with included section scope.";
    }
    if (includeAll && sectionOverlapCount > 0) {
      return "Some section roots are selected in both include and exclude scope.";
    }
    return null;
  }, [
    includeAll,
    includedSectionIds.length,
    sectionOverlapCount,
    selectedCaseCountInScope,
    selectedCaseIds.length,
    suiteId
  ]);
  const effectiveIncludeAll = compositionMode === "include_all_live" ? true : includeAll;
  const isSubmitDisabled =
    !name.trim() ||
    !suiteId ||
    mutation.isPending ||
    (compositionMode === "static" && !effectiveIncludeAll && selectedCaseIds.length === 0) ||
    (compositionMode === "static" &&
      !effectiveIncludeAll &&
      includedSectionIds.length > 0 &&
      selectedCaseCountInScope === 0);

  const applyCreateFilterSelection = (mode: FilterSelectionMode) => {
    const matching = matchCasesByCreateFilter(
      cases.map((row) => ({
        id: String(row.id),
        priority: (row as { priority?: string | null }).priority ?? null,
        sectionId: row.sectionId
      })),
      {
        priority: filterPriority,
        state: filterState,
        includedSectionIds,
        includedScopedCaseIds
      }
    );
    setSelectedCaseIds((current) => applyIdSelectionMode(mode, current, matching));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !suiteId) return;
    const filterDefinition =
      compositionMode === "dynamic_filter"
        ? {
            ...(filterPriority ? { priority: filterPriority } : {}),
            state: filterState,
            ...(includedSectionIds.length > 0 ? { includedSectionIds } : {})
          }
        : undefined;
    mutation.mutate(
      {
        suiteId,
        name: name.trim(),
        includeAll: effectiveIncludeAll,
        caseIds: effectiveIncludeAll ? undefined : selectedCaseIds,
        excludedCaseIds: effectiveIncludeAll ? excludedCaseIds : undefined,
        includedSectionIds:
          compositionMode !== "dynamic_filter" && includedSectionIds.length > 0
            ? includedSectionIds
            : undefined,
        excludedSectionIds: effectiveIncludeAll && excludedSectionIds.length > 0 ? excludedSectionIds : undefined,
        milestoneId: milestoneId || null,
        startedAt: dateInputToIso(startDate),
        dueOn: dateInputToIso(endDate),
        environment: environment.trim() || undefined,
        compositionMode,
        filterDefinition
      },
      {
      onSuccess: (run) => navigate(`/projects/${projectId}/runs/${run.id}`),
      }
    );
  };

  if (suitesQuery.isLoading || casesQuery.isLoading || milestonesQuery.isLoading) {
    return <LoadingState message="Loading run create dependencies…" />;
  }
  if (suitesQuery.isError || casesQuery.isError || milestonesQuery.isError) {
    return (
      <ErrorState
        title="Could not load suite/case data"
        onRetry={() => {
          void suitesQuery.refetch();
          void casesQuery.refetch();
          void milestonesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">New test run</h2>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. Smoke — nightly"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Suite
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={suiteId}
            onChange={(e) => {
              setSuiteId(e.target.value);
              setSelectedCaseIds([]);
              setExcludedCaseIds([]);
              setIncludedSectionIds([]);
              setExcludedSectionIds([]);
              setSectionFilterNotice(null);
              suiteHydratedRef.current = null;
            }}
          >
            <option value="">Select suite</option>
            {suites.map((suite) => (
              <option key={suite.id} value={String(suite.id)}>
                {suite.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Milestone (optional)
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
          >
            <option value="">No milestone</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={String(milestone.id)}>
                {milestone.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Selecting a milestone can prefill start/end dates from its schedule.
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Start date (optional)
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            End date (optional)
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Environment
          <input
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. staging / chrome"
          />
        </label>
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Composition mode</legend>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="compositionMode"
                checked={compositionMode === "static"}
                onChange={() => setCompositionMode("static")}
              />
              Static snapshot (default TestRail-style selection)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="compositionMode"
                checked={compositionMode === "include_all_live"}
                onChange={() => {
                  setCompositionMode("include_all_live");
                  setIncludeAll(true);
                }}
              />
              Include all — live sync (new cases auto-added to open run)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="compositionMode"
                checked={compositionMode === "dynamic_filter"}
                onChange={() => {
                  setCompositionMode("dynamic_filter");
                  setIncludeAll(false);
                  setSelectedCaseIds([]);
                }}
              />
              Dynamic filter — cases matching filter stay in the run
            </label>
          </div>
        </fieldset>
        {compositionMode === "static" ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => {
                const nextIncludeAll = e.target.checked;
                setIncludeAll(nextIncludeAll);
                if (nextIncludeAll) {
                  setSelectedCaseIds([]);
                } else {
                  setExcludedCaseIds([]);
                  setExcludedSectionIds([]);
                }
              }}
            />
            Include all cases in suite
          </label>
        ) : null}
        {compositionMode === "dynamic_filter" ? (
          <div className="rounded border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-700">Filter definition</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Priority
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  <option value="">Any</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                Case state
                <select
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value as "active" | "archived")}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">Optional section roots below also apply to the filter.</p>
          </div>
        ) : null}
        {suiteId ? (
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">Section scope (optional)</p>
            <p className="mt-1 text-xs text-slate-500">
              선택한 섹션 루트와 하위 섹션에 속한 케이스만 포함합니다. 개별 케이스 선택 모드에서는 선택 케이스와의 교집합이 됩니다.
            </p>
            {sectionFilterNotice ? (
              <p className="mt-2 text-xs text-amber-700" role="status">
                {sectionFilterNotice}
              </p>
            ) : null}
            {sectionsQuery.isLoading ? (
              <p className="mt-2 text-xs text-slate-500">Loading sections…</p>
            ) : sectionsQuery.isError ? (
              <p className="mt-2 text-xs text-rose-600">Could not load sections.</p>
            ) : sections.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No sections in this suite.</p>
            ) : (
              <div className="mt-2 max-h-36 space-y-1 overflow-auto">
                {sections.map((sec) => {
                  const sid = String(sec.id);
                  const depth = sectionDepth.get(sid) ?? 0;
                  const caseCount = subtreeCaseCountBySectionId.get(sid) ?? 0;
                  return (
                    <label key={sid} className="flex items-center gap-2 text-xs text-slate-700" style={{ paddingLeft: `${depth * 12}px` }}>
                      <input
                        type="checkbox"
                        checked={includedSectionIds.includes(sid)}
                        onChange={(e) =>
                          setIncludedSectionIds((prev) =>
                            e.target.checked ? [...prev, sid] : prev.filter((x) => x !== sid)
                          )
                        }
                      />
                      <span className="truncate">{sec.name}</span>
                      <span className="text-[11px] text-slate-400">({caseCount})</span>
                    </label>
                  );
                })}
              </div>
            )}
            {includeAll ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-600">Exclude section subtrees (optional)</p>
                <p className="mt-1 text-xs text-slate-500">include-all 모드에서만 적용됩니다.</p>
                {sections.length > 0 ? (
                  <div className="mt-2 max-h-36 space-y-1 overflow-auto">
                    {sections.map((sec) => {
                      const sid = String(sec.id);
                      const depth = sectionDepth.get(sid) ?? 0;
                      const caseCount = subtreeCaseCountBySectionId.get(sid) ?? 0;
                      return (
                        <label
                          key={`ex-${sid}`}
                          className="flex items-center gap-2 text-xs text-slate-700"
                          style={{ paddingLeft: `${depth * 12}px` }}
                        >
                          <input
                            type="checkbox"
                            checked={excludedSectionIds.includes(sid)}
                            onChange={(e) =>
                              setExcludedSectionIds((prev) =>
                                e.target.checked ? [...prev, sid] : prev.filter((x) => x !== sid)
                              )
                            }
                          />
                          <span className="truncate">{sec.name}</span>
                          <span className="text-[11px] text-slate-400">({caseCount})</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {includeAll ? (
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">Exclude cases (optional)</p>
            <p className="mt-1 text-xs text-slate-500">
              Leave unchecked to include all cases in this suite.
            </p>
            <div className="mt-2 max-h-48 space-y-1 overflow-auto">
              {!suiteId ? (
                <p className="text-xs text-slate-500">Select a suite first.</p>
              ) : null}
              {cases.map((c) => {
                const id = String(c.id);
                return (
                  <label key={id} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={excludedCaseIds.includes(id)}
                      onChange={(e) => {
                        setExcludedCaseIds((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((value) => value !== id)
                        );
                      }}
                    />
                    {c.title}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        {!includeAll ? (
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">Select cases</p>
            {compositionMode === "static" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => applyCreateFilterSelection("set")}
                >
                  Set to filter
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => applyCreateFilterSelection("add")}
                >
                  Add filter
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => applyCreateFilterSelection("remove")}
                >
                  Remove filter
                </button>
              </div>
            ) : null}
            <div className="mt-2 max-h-48 space-y-1 overflow-auto">
              {!suiteId ? (
                <p className="text-xs text-slate-500">Select a suite first.</p>
              ) : null}
              {cases.map((c) => {
                const id = String(c.id);
                const outOfScope =
                  includedSectionIds.length > 0 &&
                  c.sectionId &&
                  !includedScopedCaseIds.has(id) &&
                  selectedCaseIdSet.has(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-2 text-xs ${outOfScope ? "text-amber-700" : "text-slate-700"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCaseIds.includes(id)}
                      onChange={(e) => {
                        setSelectedCaseIds((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((value) => value !== id)
                        );
                      }}
                    />
                    {c.title}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Scope summary: {runScopeSummary}
          {selectionValidationMessage ? <p className="mt-1 text-amber-700">{selectionValidationMessage}</p> : null}
        </div>
        {mutation.isError ? <ErrorState title="Could not create run" /> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/runs`)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Create run"}
          </button>
        </div>
      </form>
    </div>
  );
}
