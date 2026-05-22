import { describe, expect, it } from "vitest";

import { buildEntityJumpPath, parseEntityJumpToken } from "./entityJump";

describe("parseEntityJumpToken", () => {
  it("parses C/R/M/P prefixes", () => {
    expect(parseEntityJumpToken("C501")).toEqual({ kind: "case", id: "501" });
    expect(parseEntityJumpToken("r12")).toEqual({ kind: "run", id: "12" });
    expect(parseEntityJumpToken("M3")).toEqual({ kind: "milestone", id: "3" });
    expect(parseEntityJumpToken("P9")).toEqual({ kind: "plan", id: "9" });
  });

  it("parses hash case shortcut", () => {
    expect(parseEntityJumpToken("#44")).toEqual({ kind: "case", id: "44" });
  });

  it("returns null for free text", () => {
    expect(parseEntityJumpToken("login flow")).toBeNull();
  });
});

describe("buildEntityJumpPath", () => {
  it("opens cases in the repository workbench", () => {
    expect(buildEntityJumpPath("p1", { kind: "case", id: "12" })).toBe(
      "/projects/p1/cases?panelCaseId=12"
    );
  });

  it("builds run and milestone paths", () => {
    expect(buildEntityJumpPath("p1", { kind: "run", id: "5" })).toBe("/projects/p1/runs/5");
    expect(buildEntityJumpPath("p1", { kind: "milestone", id: "2" })).toBe("/projects/p1/milestones/2");
  });
});
