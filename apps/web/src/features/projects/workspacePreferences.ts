export type WorkspaceLandingPage =
  | "overview"
  | "cases"
  | "runs"
  | "milestones"
  | "plans"
  | "reports"
  | "my-tests"
  | "team-todo"
  | "results"
  | "activity"
  | "automation"
  | "import-export"
  | "shared-steps"
  | "settings";

export type WorkspacePreferences = {
  landingPage: WorkspaceLandingPage;
  defaultSuiteId: string | null;
  defaultSavedViewId: string | null;
};

export const WORKSPACE_LANDING_OPTIONS: Array<{ value: WorkspaceLandingPage; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "cases", label: "Test Cases" },
  { value: "runs", label: "Test Runs & Results" },
  { value: "milestones", label: "Milestones" },
  { value: "plans", label: "Test Plans" },
  { value: "reports", label: "Reports" },
  { value: "my-tests", label: "My Tests" },
  { value: "team-todo", label: "Team Todo" },
  { value: "results", label: "Result Explorer" },
  { value: "activity", label: "Activity" },
  { value: "automation", label: "Automation" },
  { value: "import-export", label: "Import/Export" },
  { value: "shared-steps", label: "Shared Steps" },
  { value: "settings", label: "Settings" }
];

export function projectLandingPath(projectId: string, landingPage: WorkspaceLandingPage): string {
  const base = `/projects/${projectId}`;
  if (landingPage === "overview") return base;
  return `${base}/${landingPage}`;
}

export function suiteStorageKey(projectId: string, userId?: string | null) {
  return userId ? `cases:active-suite:${userId}.${projectId}` : `cases:active-suite:${projectId}`;
}
