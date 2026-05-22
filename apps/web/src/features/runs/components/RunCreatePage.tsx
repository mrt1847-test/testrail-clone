import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import type { RunCompositionCaseRow } from "./RunCompositionCaseTable";
import { RunCompositionWorkbench } from "./RunCompositionWorkbench";
import {
  buildDescendantIdsBySection,
  buildSubtreeCaseCounts,
  mapRunCreateSections
} from "../utils/runCreateSections";

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

type ApiCaseRow = {
  id: string;
  title: string;
  sectionId?: string;
  priority?: string | null;
  archivedAt?: string | null;
};

export function RunCreatePage() {
  const { projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [suiteId, setSuiteId] = useState(searchParams.get("suiteId") ?? "");
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
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
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
      fetchAllPagedRows<ApiCaseRow>(
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
      fetchAllPagedRows<{ id: string; name: string; parentSectionId?: string | null; displayOrder?: number }>(
        (page, pageSize) => `/api/suites/${suiteId}/sections?page=${page}&pageSize=${pageSize}`
      ),
    enabled: Boolean(suiteId)
  });

  const suites = suitesQuery.data ?? [];
  const rawCases = casesQuery.data ?? [];
  const sectionNodes = useMemo(
    () => (suiteId ? mapRunCreateSections(sectionsQuery.data ?? [], suiteId) : []),
    [sectionsQuery.data, suiteId]
  );
  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of sectionNodes) map.set(String(section.id), section.name);
    return map;
  }, [sectionNodes]);
  const cases: RunCompositionCaseRow[] = useMemo(
    () =>
      rawCases.map((row) => ({
        id: String(row.id),
        title: row.title,
        sectionId: row.sectionId,
        sectionName: row.sectionId ? sectionNameById.get(String(row.sectionId)) : undefined,
        priority: row.priority ?? null,
        archived: Boolean(row.archivedAt)
      })),
    [rawCases, sectionNameById]
  );
  const milestones = milestonesQuery.data ?? [];
  const validSectionIds = useMemo(
    () => buildValidSectionIdSet(sectionNodes.map((section) => section.id)),
    [sectionNodes]
  );
  const descendantIdsBySectionId = useMemo(() => buildDescendantIdsBySection(sectionNodes), [sectionNodes]);
  const subtreeCaseCountBySectionId = useMemo(
    () => buildSubtreeCaseCounts(sectionNodes, cases, descendantIdsBySectionId),
    [cases, descendantIdsBySectionId, sectionNodes]
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
  }, [excludedSectionIds, includedSectionIds, pruneAgainstValidSections, suiteId, validSectionIds]);

  const includedScopedCaseIds = useMemo(() => {
    if (includedSectionIds.length === 0) return new Set<string>(cases.map((row) => row.id));
    const allowedSectionIds = new Set<number>();
    for (const sid of includedSectionIds) {
      const numeric = Number(sid);
      const descendants = descendantIdsBySectionId.get(numeric);
      if (!descendants) continue;
      for (const childId of descendants) allowedSectionIds.add(childId);
    }
    const out = new Set<string>();
    for (const row of cases) {
      if (row.sectionId && allowedSectionIds.has(Number(row.sectionId))) out.add(row.id);
    }
    return out;
  }, [cases, descendantIdsBySectionId, includedSectionIds]);

  const visibleCaseIds = useMemo(() => {
    if (selectedSectionId != null) {
      const descendants = descendantIdsBySectionId.get(selectedSectionId) ?? new Set([selectedSectionId]);
      const out = new Set<string>();
      for (const row of cases) {
        if (row.sectionId && descendants.has(Number(row.sectionId))) out.add(row.id);
      }
      return out;
    }
    if (includedSectionIds.length > 0) return includedScopedCaseIds;
    return new Set<string>(cases.map((row) => row.id));
  }, [cases, descendantIdsBySectionId, includedScopedCaseIds, includedSectionIds.length, selectedSectionId]);

  const selectedCaseCountInScope = useMemo(() => {
    if (includeAll) return 0;
    let count = 0;
    for (const cid of selectedCaseIds) {
      if (includedScopedCaseIds.has(cid)) count += 1;
    }
    return count;
  }, [includeAll, includedScopedCaseIds, selectedCaseIds]);

  const sectionOverlapCount = useMemo(() => {
    const included = new Set(includedSectionIds);
    let count = 0;
    for (const sid of excludedSectionIds) {
      if (included.has(sid)) count += 1;
    }
    return count;
  }, [excludedSectionIds, includedSectionIds]);

  const runScopeSummary = useMemo(() => {
    if (compositionMode === "dynamic_filter") {
      return `Dynamic filter · priority ${filterPriority || "any"} · ${filterState} · section roots ${includedSectionIds.length}`;
    }
    if (includeAll || compositionMode === "include_all_live") {
      return `${cases.length} cases in suite · include roots ${includedSectionIds.length} · exclude roots ${excludedSectionIds.length} · excluded cases ${excludedCaseIds.length}`;
    }
    return `${selectedCaseIds.length} selected · ${selectedCaseCountInScope} in section scope`;
  }, [
    cases.length,
    compositionMode,
    excludedCaseIds.length,
    excludedSectionIds.length,
    filterPriority,
    filterState,
    includeAll,
    includedSectionIds.length,
    selectedCaseCountInScope,
    selectedCaseIds.length
  ]);

  const selectionValidationMessage = useMemo(() => {
    if (!suiteId) return "Select a suite first.";
    if (compositionMode === "dynamic_filter") return null;
    if (!includeAll && selectedCaseIds.length === 0) return "Select at least one case.";
    if (!includeAll && includedSectionIds.length > 0 && selectedCaseCountInScope === 0) {
      return "Selected cases do not intersect with included section scope.";
    }
    if (includeAll && sectionOverlapCount > 0) {
      return "Some section roots are selected in both include and exclude scope.";
    }
    return null;
  }, [
    compositionMode,
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

  const resetSuiteSelection = () => {
    setSelectedCaseIds([]);
    setExcludedCaseIds([]);
    setIncludedSectionIds([]);
    setExcludedSectionIds([]);
    setSelectedSectionId(null);
    setSectionFilterNotice(null);
    suiteHydratedRef.current = null;
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
        onSuccess: (run) => navigate(`/projects/${projectId}/runs/${run.id}`)
      }
    );
  };

  if (suitesQuery.isLoading || casesQuery.isLoading || milestonesQuery.isLoading) {
    return <LoadingState message="Loading run create workbench…" />;
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
    <RunCompositionWorkbench
      projectId={projectId}
      name={name}
      onNameChange={setName}
      suiteId={suiteId}
      suites={suites}
      onSuiteChange={(nextSuiteId) => {
        setSuiteId(nextSuiteId);
        resetSuiteSelection();
      }}
      milestoneId={milestoneId}
      milestones={milestones}
      onMilestoneChange={setMilestoneId}
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      environment={environment}
      onEnvironmentChange={setEnvironment}
      compositionMode={compositionMode}
      onCompositionModeChange={(mode) => {
        setCompositionMode(mode);
        if (mode === "dynamic_filter") {
          setIncludeAll(false);
          setSelectedCaseIds([]);
        }
      }}
      includeAll={includeAll}
      onIncludeAllChange={(next) => {
        setIncludeAll(next);
        if (next) {
          setSelectedCaseIds([]);
        } else {
          setExcludedCaseIds([]);
          setExcludedSectionIds([]);
        }
      }}
      filterPriority={filterPriority}
      onFilterPriorityChange={setFilterPriority}
      filterState={filterState}
      onFilterStateChange={setFilterState}
      sections={sectionNodes}
      sectionsLoading={sectionsQuery.isLoading}
      selectedSectionId={selectedSectionId}
      onSelectSection={setSelectedSectionId}
      includedSectionIds={includedSectionIds}
      excludedSectionIds={excludedSectionIds}
      onToggleIncludeSection={(sid, checked) =>
        setIncludedSectionIds((prev) => (checked ? [...prev, sid] : prev.filter((x) => x !== sid)))
      }
      onToggleExcludeSection={(sid, checked) =>
        setExcludedSectionIds((prev) => (checked ? [...prev, sid] : prev.filter((x) => x !== sid)))
      }
      subtreeCaseCountBySectionId={subtreeCaseCountBySectionId}
      cases={cases}
      visibleCaseIds={visibleCaseIds}
      selectedCaseIds={selectedCaseIds}
      excludedCaseIds={excludedCaseIds}
      onSelectedCaseIdsChange={setSelectedCaseIds}
      onExcludedCaseIdsChange={setExcludedCaseIds}
      includedScopedCaseIds={includedScopedCaseIds}
      runScopeSummary={runScopeSummary}
      selectionValidationMessage={selectionValidationMessage}
      sectionFilterNotice={sectionFilterNotice}
      isSubmitDisabled={isSubmitDisabled}
      isPending={mutation.isPending}
      onCancel={() => navigate(`/projects/${projectId}/runs`)}
      onSubmit={onSubmit}
      errorSlot={mutation.isError ? <ErrorState title="Could not create run" /> : null}
    />
  );
}
