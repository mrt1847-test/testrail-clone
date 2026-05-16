export const PROJECT_TYPES = ["single_repo", "single_repo_baselines", "multi_suite"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  single_repo: "Single repository",
  single_repo_baselines: "Single repository with baselines",
  multi_suite: "Multiple test suites"
};

export function normalizeProjectType(value: unknown): ProjectType {
  if (typeof value === "string" && PROJECT_TYPES.includes(value as ProjectType)) {
    return value as ProjectType;
  }
  return "single_repo";
}

export type SuitePolicyRow = {
  isMaster: boolean;
  isBaseline: boolean;
};

export function projectTypeAllowsMultipleSuites(projectType: ProjectType) {
  return projectType === "multi_suite" || projectType === "single_repo_baselines";
}

export function projectTypeUsesSuiteSwitcher(projectType: ProjectType) {
  return projectType !== "single_repo";
}

export function canCreateSuite(
  projectType: ProjectType,
  existing: SuitePolicyRow[],
  input: { isBaseline?: boolean }
) {
  if (projectType === "single_repo") {
    return existing.length === 0
      ? { ok: true as const }
      : { ok: false as const, code: "PROJECT_SUITE_LIMIT", message: "Single-repository projects allow one suite." };
  }

  if (projectType === "single_repo_baselines") {
    const masterCount = existing.filter((row) => row.isMaster).length;
    if (input.isBaseline) {
      if (masterCount === 0) {
        return { ok: false as const, code: "MASTER_SUITE_REQUIRED", message: "Create the master suite before adding baselines." };
      }
      return { ok: true as const };
    }
    if (masterCount > 0) {
      return {
        ok: false as const,
        code: "PROJECT_SUITE_LIMIT",
        message: "Baseline projects have one master suite; add baselines instead of another master."
      };
    }
    return { ok: true as const };
  }

  return { ok: true as const };
}

export function shouldTreatAsMasterSuite(projectType: ProjectType, existing: SuitePolicyRow[]) {
  if (projectType === "multi_suite") {
    return existing.length === 0;
  }
  return true;
}
