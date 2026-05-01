import { useEffect, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";

type Input = {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  selectedTestId: string | null;
};

export function useRunUrlState(input: Input) {
  const { searchParams, setSearchParams, selectedTestId } = input;
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get("assignee") ?? "all");
  const [searchText, setSearchText] = useState(() => searchParams.get("q") || "");
  const [instancePage, setInstancePage] = useState(() => Math.max(1, Number(searchParams.get("page") || "1") || 1));

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "all";
    const nextAssignee = searchParams.get("assignee") ?? "all";
    const nextSearch = searchParams.get("q") || "";
    const nextPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);
    if (statusFilter !== nextStatus) setStatusFilter(nextStatus);
    if (assigneeFilter !== nextAssignee) setAssigneeFilter(nextAssignee);
    if (searchText !== nextSearch) setSearchText(nextSearch);
    if (instancePage !== nextPage) setInstancePage(nextPage);
  }, [assigneeFilter, instancePage, searchParams, searchText, statusFilter]);

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

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [assigneeFilter, instancePage, searchParams, searchText, selectedTestId, setSearchParams, statusFilter]);

  return {
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    searchText,
    setSearchText,
    instancePage,
    setInstancePage
  };
}
