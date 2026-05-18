import { describe, expect, it } from "vitest";
import { buildTestCaseChangeInfo, listSnapshotFieldChanges } from "./testCaseChangeIndicator.js";

const baseSnapshot = {
  titleSnapshot: "Login",
  prioritySnapshot: "high",
  typeSnapshot: "functional",
  automationKeySnapshot: "AUTH-1",
  externalIdSnapshot: null as string | null,
  caseLockVersionAtRun: 2
};

const baseCase = {
  lockVersion: 2,
  title: "Login",
  sectionId: 1n,
  priority: "high",
  caseType: "functional",
  automationKey: "AUTH-1",
  externalId: null,
  updatedAt: new Date("2026-05-10T12:00:00Z")
};

describe("testCaseChangeIndicator", () => {
  it("flags changed when lock version increased", () => {
    const info = buildTestCaseChangeInfo({
      instance: baseSnapshot,
      testCase: { ...baseCase, lockVersion: 4, title: "Login v2" },
      runCreatedAt: new Date("2026-05-01T00:00:00Z")
    });
    expect(info.caseChanged).toBe(true);
    expect(info.changedFields).toContain("title");
  });

  it("does not flag when case was not edited after run creation", () => {
    const info = buildTestCaseChangeInfo({
      instance: baseSnapshot,
      testCase: baseCase,
      runCreatedAt: new Date("2026-05-15T00:00:00Z")
    });
    expect(info.caseChanged).toBe(false);
    expect(info.changedFields).toEqual([]);
  });

  it("falls back to snapshot diff when lock version at run is missing", () => {
    const info = buildTestCaseChangeInfo({
      instance: { ...baseSnapshot, caseLockVersionAtRun: null },
      testCase: { ...baseCase, title: "Login updated", updatedAt: new Date("2026-05-20T00:00:00Z") },
      runCreatedAt: new Date("2026-05-01T00:00:00Z")
    });
    expect(info.caseChanged).toBe(true);
    expect(info.changedFields).toEqual(["title"]);
  });

  it("lists differing snapshot fields", () => {
    expect(
      listSnapshotFieldChanges(baseSnapshot, {
        ...baseCase,
        priority: "low",
        caseType: "regression"
      })
    ).toEqual(["priority", "type"]);
  });
});
