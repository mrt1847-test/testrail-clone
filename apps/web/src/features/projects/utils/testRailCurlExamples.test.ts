import { describe, expect, it } from "vitest";

import { buildAllApiDocEndpoints, buildEndpointFromSupported } from "./testRailCurlExamples";

const ctx = { baseUrl: "https://qa.example.com", projectId: "42" };

describe("testRailCurlExamples", () => {
  it("builds project-scoped GET curl with pagination query", () => {
    const row = buildEndpointFromSupported("GET get_cases/{project_id}", ctx);
    expect(row.path).toBe("/api/v2/get_cases/42");
    expect(row.curl).toContain("get_cases/42");
    expect(row.curl).toContain("suite_id=$SUITE_ID");
    expect(row.curl).toContain("Authorization");
  });

  it("builds POST curl with sample body", () => {
    const row = buildEndpointFromSupported("POST add_run/{project_id}", ctx);
    expect(row.method).toBe("POST");
    expect(row.curl).toContain("add_run/42");
    expect(row.curl).toContain("include_all");
  });

  it("includes automation helpers before v2 routes", () => {
    const rows = buildAllApiDocEndpoints(["GET get_projects"], ctx);
    expect(rows[0]?.category).toBe("Automation API");
    expect(rows.some((row) => row.key === "v2-index")).toBe(true);
  });
});
