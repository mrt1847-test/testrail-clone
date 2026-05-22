import { z } from "zod";

export const workspaceLandingPages = [
  "overview",
  "cases",
  "runs",
  "milestones",
  "plans",
  "reports",
  "my-tests",
  "team-todo",
  "results",
  "activity",
  "automation",
  "import-export",
  "shared-steps",
  "settings"
] as const;

export type WorkspaceLandingPage = (typeof workspaceLandingPages)[number];

export const workspaceLandingPageSchema = z.enum(workspaceLandingPages);

export const workspacePreferencesPatchSchema = z
  .object({
    landingPage: workspaceLandingPageSchema.optional(),
    defaultSuiteId: z.string().trim().min(1).nullable().optional(),
    defaultSavedViewId: z.string().trim().min(1).max(128).nullable().optional()
  })
  .refine((body) => Object.keys(body).length > 0, { message: "at least one field is required" });

export function projectLandingPath(projectId: string, landingPage: WorkspaceLandingPage): string {
  const base = `/projects/${projectId}`;
  if (landingPage === "overview") return base;
  return `${base}/${landingPage}`;
}

export function defaultWorkspacePreferences() {
  return {
    landingPage: "overview" as WorkspaceLandingPage,
    defaultSuiteId: null as string | null,
    defaultSavedViewId: null as string | null
  };
}
