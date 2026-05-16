import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { createBaselineSuite, createSuite, fetchSuites } from "../../projects/api/suitesApi";
import { useProjectQuery } from "../../projects/hooks/useProjectsApi";
import { PROJECT_TYPE_LABELS, projectTypeUsesSuiteSwitcher } from "../../projects/types/projectTypes";
import { sectionKeys } from "../hooks/useSections";

type SuiteSwitcherBarProps = {
  projectId: string;
  selectedSuiteId: string;
  onSelectSuite: (suiteId: string) => void;
};

export function SuiteSwitcherBar({ projectId, selectedSuiteId, onSelectSuite }: SuiteSwitcherBarProps) {
  const qc = useQueryClient();
  const projectQuery = useProjectQuery(projectId);
  const suitesQuery = useQuery({
    queryKey: ["project-suites", projectId],
    queryFn: () => fetchSuites(projectId),
    enabled: Boolean(projectId)
  });
  const [newSuiteName, setNewSuiteName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const projectType = projectQuery.data?.projectType;
  const showSwitcher = projectTypeUsesSuiteSwitcher(projectType);

  useEffect(() => {
    const suites = suitesQuery.data ?? [];
    if (suites.length === 0) return;
    if (!suites.some((suite) => suite.id === selectedSuiteId)) {
      const preferred = suites.find((suite) => suite.isMaster) ?? suites[0];
      if (preferred) onSelectSuite(preferred.id);
    }
  }, [onSelectSuite, selectedSuiteId, suitesQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = newSuiteName.trim();
      if (!name) throw new Error("Name is required.");
      if (projectType === "single_repo_baselines") {
        return createBaselineSuite(projectId, name);
      }
      return createSuite(projectId, { name });
    },
    onSuccess: (created) => {
      setError(null);
      setNewSuiteName("");
      void qc.invalidateQueries({ queryKey: ["project-suites", projectId] });
      void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
      onSelectSuite(created.id);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not create suite.");
    }
  });

  if (!showSwitcher) return null;

  const suites = suitesQuery.data ?? [];
  const canAddSuite = projectType === "multi_suite" || projectType === "single_repo_baselines";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[200px] flex-1 gap-1 text-sm text-slate-700">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {projectType ? PROJECT_TYPE_LABELS[projectType] : "Suite"}
          </span>
          <select
            value={selectedSuiteId}
            onChange={(event) => onSelectSuite(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          >
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
                {suite.isMaster ? " (Master)" : ""}
                {suite.isBaseline ? " (Baseline)" : ""}
              </option>
            ))}
          </select>
        </label>
        {canAddSuite ? (
          <>
            <label className="grid min-w-[180px] flex-1 gap-1 text-sm text-slate-700">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {projectType === "single_repo_baselines" ? "New baseline" : "New suite"}
              </span>
              <input
                value={newSuiteName}
                onChange={(event) => setNewSuiteName(event.target.value)}
                placeholder={projectType === "single_repo_baselines" ? "Release 2.0" : "Regression suite"}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
            <button
              type="button"
              disabled={!newSuiteName.trim() || createMutation.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={() => void createMutation.mutateAsync()}
            >
              {createMutation.isPending ? "Adding…" : "Add"}
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
