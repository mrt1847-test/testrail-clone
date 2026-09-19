export type ProjectListCreatePlacement = "none" | "header" | "empty";

export function projectListCreatePlacement(input: {
  canCreate: boolean;
  projectCount: number;
}): ProjectListCreatePlacement {
  if (!input.canCreate) return "none";
  return input.projectCount === 0 ? "empty" : "header";
}

export function formatProjectListProgress(input: { totalCases?: number; activeRuns?: number; loading?: boolean }) {
  if (input.loading) return "Loading progress…";
  const cases = input.totalCases ?? 0;
  const runs = input.activeRuns ?? 0;
  const caseLabel = cases === 1 ? "1 case" : `${cases} cases`;
  const runLabel = runs === 1 ? "1 active run" : `${runs} active runs`;
  return `${caseLabel} · ${runLabel}`;
}

export function projectListNavLinks(projectId: string) {
  const base = `/projects/${projectId}`;
  return [
    { to: `${base}/cases`, label: "Cases" },
    { to: `${base}/runs`, label: "Runs" },
    { to: `${base}/my-tests`, label: "Assigned" }
  ] as const;
}
