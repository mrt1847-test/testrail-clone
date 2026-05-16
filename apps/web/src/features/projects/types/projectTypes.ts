export const PROJECT_TYPES = ["single_repo", "single_repo_baselines", "multi_suite"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  single_repo: "Single repository",
  single_repo_baselines: "Single repository with baselines",
  multi_suite: "Multiple test suites"
};

export function projectTypeUsesSuiteSwitcher(projectType: ProjectType | undefined) {
  return projectType != null && projectType !== "single_repo";
}

export function normalizeProjectType(value: unknown): ProjectType {
  if (typeof value === "string" && PROJECT_TYPES.includes(value as ProjectType)) {
    return value as ProjectType;
  }
  return "single_repo";
}
