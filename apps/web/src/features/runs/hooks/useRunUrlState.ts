import { useEffect, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";

import type { RunInstanceGroupBy } from "../types";
import type { RunFilterCaseType, RunFilterPriority, RunSortBy, RunSortDir } from "../utils/runInstanceListParams";

type Input = {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  selectedTestId: string | null;
};

export type RunDisplayMode = "subtree" | "tree" | "compact";

function parseGroupBy(raw: string | null): RunInstanceGroupBy {
  if (raw === "priority" || raw === "type" || raw === "none") return raw;
  return "section_id";
}

function parseSectionId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDisplay(raw: string | null): RunDisplayMode {
  if (raw === "tree" || raw === "compact") return raw;
  return "subtree";
}

function parsePriority(raw: string | null): RunFilterPriority {
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return "";
}

function parseCaseType(raw: string | null): RunFilterCaseType {
  if (raw === "functional" || raw === "integration" || raw === "regression") return raw;
  return "";
}

function parseCaseChanged(raw: string | null): boolean {
  return raw === "true" || raw === "1";
}

function parseSortBy(raw: string | null): RunSortBy {
  if (
    raw === "title" ||
    raw === "status" ||
    raw === "priority" ||
    raw === "type" ||
    raw === "assignee"
  ) {
    return raw;
  }
  return "case_id";
}

function parseSortDir(raw: string | null): RunSortDir {
  return raw === "desc" ? "desc" : "asc";
}

export function useRunUrlState(input: Input) {
  const { searchParams, setSearchParams, selectedTestId } = input;
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get("assignee") ?? "all");
  const [searchText, setSearchText] = useState(() => searchParams.get("q") || "");
  const [instancePage, setInstancePage] = useState(() => Math.max(1, Number(searchParams.get("page") || "1") || 1));
  const [sectionId, setSectionId] = useState<number | null>(() => parseSectionId(searchParams.get("sectionId")));
  const [groupBy, setGroupBy] = useState<RunInstanceGroupBy>(() => parseGroupBy(searchParams.get("groupBy")));
  const [display, setDisplay] = useState<RunDisplayMode>(() => parseDisplay(searchParams.get("display")));
  const [priorityFilter, setPriorityFilter] = useState<RunFilterPriority>(() => parsePriority(searchParams.get("priority")));
  const [caseTypeFilter, setCaseTypeFilter] = useState<RunFilterCaseType>(() => parseCaseType(searchParams.get("caseType")));
  const [caseChangedFilter, setCaseChangedFilter] = useState(() => parseCaseChanged(searchParams.get("caseChanged")));
  const [sortBy, setSortBy] = useState<RunSortBy>(() => parseSortBy(searchParams.get("sortBy")));
  const [sortDir, setSortDir] = useState<RunSortDir>(() => parseSortDir(searchParams.get("sortDir")));

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "all";
    const nextAssignee = searchParams.get("assignee") ?? "all";
    const nextSearch = searchParams.get("q") || "";
    const nextPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);
    const nextSectionId = parseSectionId(searchParams.get("sectionId"));
    const nextGroupBy = parseGroupBy(searchParams.get("groupBy"));
    const nextDisplay = parseDisplay(searchParams.get("display"));
    const nextPriority = parsePriority(searchParams.get("priority"));
    const nextCaseType = parseCaseType(searchParams.get("caseType"));
    const nextCaseChanged = parseCaseChanged(searchParams.get("caseChanged"));
    const nextSortBy = parseSortBy(searchParams.get("sortBy"));
    const nextSortDir = parseSortDir(searchParams.get("sortDir"));
    if (statusFilter !== nextStatus) setStatusFilter(nextStatus);
    if (assigneeFilter !== nextAssignee) setAssigneeFilter(nextAssignee);
    if (searchText !== nextSearch) setSearchText(nextSearch);
    if (instancePage !== nextPage) setInstancePage(nextPage);
    if (sectionId !== nextSectionId) setSectionId(nextSectionId);
    if (groupBy !== nextGroupBy) setGroupBy(nextGroupBy);
    if (display !== nextDisplay) setDisplay(nextDisplay);
    if (priorityFilter !== nextPriority) setPriorityFilter(nextPriority);
    if (caseTypeFilter !== nextCaseType) setCaseTypeFilter(nextCaseType);
    if (caseChangedFilter !== nextCaseChanged) setCaseChangedFilter(nextCaseChanged);
    if (sortBy !== nextSortBy) setSortBy(nextSortBy);
    if (sortDir !== nextSortDir) setSortDir(nextSortDir);
  }, [
    assigneeFilter,
    caseChangedFilter,
    caseTypeFilter,
    display,
    groupBy,
    instancePage,
    priorityFilter,
    searchParams,
    searchText,
    sectionId,
    sortBy,
    sortDir,
    statusFilter
  ]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (statusFilter === "all") next.delete("status");
    else next.set("status", statusFilter);

    if (assigneeFilter === "all") next.delete("assignee");
    else next.set("assignee", assigneeFilter);

    if (searchText.trim()) next.set("q", searchText.trim());
    else next.delete("q");

    if (instancePage > 1) next.set("page", String(instancePage));
    else next.delete("page");

    if (selectedTestId) next.set("testId", selectedTestId);
    else next.delete("testId");

    if (sectionId != null) next.set("sectionId", String(sectionId));
    else next.delete("sectionId");

    if (groupBy === "section_id") next.delete("groupBy");
    else next.set("groupBy", groupBy);

    if (display === "subtree") next.delete("display");
    else next.set("display", display);

    if (priorityFilter) next.set("priority", priorityFilter);
    else next.delete("priority");

    if (caseTypeFilter) next.set("caseType", caseTypeFilter);
    else next.delete("caseType");

    if (caseChangedFilter) next.set("caseChanged", "true");
    else next.delete("caseChanged");

    if (sortBy === "case_id") next.delete("sortBy");
    else next.set("sortBy", sortBy);

    if (sortDir === "asc") next.delete("sortDir");
    else next.set("sortDir", sortDir);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    assigneeFilter,
    caseChangedFilter,
    caseTypeFilter,
    display,
    groupBy,
    instancePage,
    priorityFilter,
    searchParams,
    searchText,
    sectionId,
    selectedTestId,
    setSearchParams,
    sortBy,
    sortDir,
    statusFilter
  ]);

  return {
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    searchText,
    setSearchText,
    instancePage,
    setInstancePage,
    sectionId,
    setSectionId,
    groupBy,
    setGroupBy,
    display,
    setDisplay,
    priorityFilter,
    setPriorityFilter,
    caseTypeFilter,
    setCaseTypeFilter,
    caseChangedFilter,
    setCaseChangedFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir
  };
}
