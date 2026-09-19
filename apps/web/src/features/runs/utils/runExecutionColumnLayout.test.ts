import { describe, expect, it } from "vitest";

import {
  RUN_EXECUTION_ESSENTIAL_COLUMNS,
  runExecutionOptionalColumnVisibility
} from "./runExecutionColumnLayout";

describe("runExecutionColumnLayout", () => {
  it("keeps title and status essential while demoting optional metadata first", () => {
    expect(RUN_EXECUTION_ESSENTIAL_COLUMNS).toEqual(["select", "case", "title", "status"]);
  });

  it("hides optional columns in a 1280 workbench table squeezed by tree and result pane", () => {
    const visibility = runExecutionOptionalColumnVisibility({
      containerWidth: 345,
      requestedColumns: ["priority"],
      showWatch: true
    });
    expect(visibility).toEqual({
      priority: false,
      assignee: false,
      type: false,
      updated: false,
      watch: false
    });
  });

  it("hides optional columns on a 390 stacked tests column", () => {
    const visibility = runExecutionOptionalColumnVisibility({
      containerWidth: 343,
      requestedColumns: ["priority", "type"],
      showWatch: true
    });
    expect(visibility.assignee).toBe(false);
    expect(visibility.priority).toBe(false);
    expect(visibility.updated).toBe(false);
  });

  it("restores assignee before watch when the table has medium width", () => {
    const visibility = runExecutionOptionalColumnVisibility({
      containerWidth: 520,
      requestedColumns: ["priority"],
      showWatch: true
    });
    expect(visibility.assignee).toBe(true);
    expect(visibility.priority).toBe(true);
    expect(visibility.updated).toBe(false);
    expect(visibility.watch).toBe(false);
  });

  it("shows requested metadata only once the table is wide", () => {
    const visibility = runExecutionOptionalColumnVisibility({
      containerWidth: 880,
      requestedColumns: ["priority", "type"],
      showWatch: true
    });
    expect(visibility).toEqual({
      priority: true,
      assignee: true,
      type: true,
      updated: true,
      watch: true
    });
  });
});
