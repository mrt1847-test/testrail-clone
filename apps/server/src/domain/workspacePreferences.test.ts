import { describe, expect, it } from "vitest";

import { projectLandingPath, workspaceLandingPageSchema } from "./workspacePreferences.js";

describe("workspacePreferences", () => {
  it("maps landing pages to project routes", () => {
    expect(projectLandingPath("12", "overview")).toBe("/projects/12");
    expect(projectLandingPath("12", "cases")).toBe("/projects/12/cases");
    expect(projectLandingPath("12", "my-tests")).toBe("/projects/12/my-tests");
  });

  it("rejects unknown landing pages", () => {
    expect(workspaceLandingPageSchema.safeParse("dashboard").success).toBe(false);
  });
});
