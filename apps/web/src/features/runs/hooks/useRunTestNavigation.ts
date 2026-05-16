import { useCallback, useState } from "react";

import { fetchRunInstancesPage } from "../api/runApi";
import type { TestInstanceRow } from "../types";

type ApiInstance = {
  id: string | number;
  caseId: string | number;
  titleSnapshot: string;
  status: string;
  assignedTo?: string | number | null;
};

function mapInstance(instance: ApiInstance): TestInstanceRow {
  return {
    id: String(instance.id),
    caseId: String(instance.caseId),
    caseCode: `C${instance.caseId}`,
    title: instance.titleSnapshot,
    status: instance.status,
    assignedTo: instance.assignedTo != null ? String(instance.assignedTo) : null
  };
}

type Input = {
  projectId: string;
  runId: string;
  selectedTestId: string | null;
  pagedInstances: TestInstanceRow[];
  statusFilter: string;
  assigneeFilter: string;
  searchText: string;
  setStatusFilter: (value: string) => void;
  setInstancePage: (value: number | ((prev: number) => number)) => void;
  onSelectInstance: (instance: TestInstanceRow) => void;
};

export function useRunTestNavigation(input: Input) {
  const {
    projectId,
    runId,
    selectedTestId,
    pagedInstances,
    statusFilter,
    assigneeFilter,
    searchText,
    setStatusFilter,
    setInstancePage,
    onSelectInstance
  } = input;
  const [isNavigating, setIsNavigating] = useState(false);

  const scrollToTests = useCallback(() => {
    document.getElementById("run-tests-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const fetchFilteredInstances = useCallback(async () => {
    const res = await fetchRunInstancesPage({
      projectId,
      runId,
      page: 1,
      pageSize: 500,
      status: statusFilter,
      assignee: assigneeFilter,
      search: searchText
    });
    return res.data.map(mapInstance);
  }, [assigneeFilter, projectId, runId, searchText, statusFilter]);

  const jumpToStatus = useCallback(
    (status: string) => {
      setStatusFilter(status);
      setInstancePage(1);
      scrollToTests();
    },
    [scrollToTests, setInstancePage, setStatusFilter]
  );

  const goNextByStatus = useCallback(
    async (status: "failed" | "blocked") => {
      setIsNavigating(true);
      try {
        const res = await fetchRunInstancesPage({
          projectId,
          runId,
          page: 1,
          pageSize: 500,
          status
        });
        const rows = res.data.map(mapInstance);
        if (rows.length === 0) return;

        const currentIdx = selectedTestId ? rows.findIndex((row) => row.id === selectedTestId) : -1;
        const nextRow =
          currentIdx >= 0 && currentIdx < rows.length - 1 ? rows[currentIdx + 1]! : rows[0]!;

        setStatusFilter(status);
        setInstancePage(1);
        onSelectInstance(nextRow);
        scrollToTests();
      } finally {
        setIsNavigating(false);
      }
    },
    [onSelectInstance, projectId, runId, scrollToTests, selectedTestId, setInstancePage, setStatusFilter]
  );

  const goAdjacentTest = useCallback(
    async (direction: "prev" | "next") => {
      const localIdx = selectedTestId ? pagedInstances.findIndex((row) => row.id === selectedTestId) : -1;
      if (direction === "next" && localIdx >= 0 && localIdx < pagedInstances.length - 1) {
        onSelectInstance(pagedInstances[localIdx + 1]!);
        return;
      }
      if (direction === "prev" && localIdx > 0) {
        onSelectInstance(pagedInstances[localIdx - 1]!);
        return;
      }

      setIsNavigating(true);
      try {
        const rows = await fetchFilteredInstances();
        if (rows.length === 0) return;

        const idx = selectedTestId ? rows.findIndex((row) => row.id === selectedTestId) : -1;
        if (direction === "next") {
          const nextIdx = idx < 0 ? 0 : idx >= rows.length - 1 ? 0 : idx + 1;
          onSelectInstance(rows[nextIdx]!);
        } else {
          const prevIdx = idx <= 0 ? rows.length - 1 : idx - 1;
          onSelectInstance(rows[prevIdx]!);
        }
        scrollToTests();
      } finally {
        setIsNavigating(false);
      }
    },
    [fetchFilteredInstances, onSelectInstance, pagedInstances, scrollToTests, selectedTestId]
  );

  return {
    isNavigating,
    jumpToStatus,
    goNextFailed: () => void goNextByStatus("failed"),
    goNextBlocked: () => void goNextByStatus("blocked"),
    goPrevTest: () => void goAdjacentTest("prev"),
    goNextTest: () => void goAdjacentTest("next"),
    scrollToTests
  };
}
