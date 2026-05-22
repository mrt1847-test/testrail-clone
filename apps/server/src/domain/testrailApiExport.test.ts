import { describe, expect, it } from "vitest";

import {
  buildTestRailOpenApiDocument,
  buildTestRailPostmanCollection,
  listExportedV2Routes
} from "./testrailApiExport.js";
import { TESTRAIL_V2_SUPPORTED } from "../modules/testrail/testrail.supported.js";

describe("testrailApiExport", () => {
  it("maps supported entries to Fastify-style paths", () => {
    const routes = listExportedV2Routes(TESTRAIL_V2_SUPPORTED);
    expect(routes.length).toBe(TESTRAIL_V2_SUPPORTED.length);
    const cases = routes.find((row) => row.key === "GET get_cases/{project_id}");
    expect(cases?.path).toBe("/api/v2/get_cases/{projectId}");
    const config = routes.find((row) => row.key === "POST update_config/{config_id}");
    expect(config?.path).toBe("/api/v2/update_config/{configurationId}");
  });

  it("builds OpenAPI with a path per supported route", () => {
    const doc = buildTestRailOpenApiDocument("https://qa.example.com", TESTRAIL_V2_SUPPORTED);
    expect(doc.openapi).toBe("3.0.3");
    expect(Object.keys(doc.paths).length).toBe(TESTRAIL_V2_SUPPORTED.length);
    expect(doc.paths["/api/v2/get_projects"]).toBeTruthy();
  });

  it("builds Postman collection folders and requests", () => {
    const collection = buildTestRailPostmanCollection("https://qa.example.com", TESTRAIL_V2_SUPPORTED);
    expect(collection.info.schema).toContain("postman.com");
    const requestCount = collection.item.reduce(
      (sum, folder) => sum + (folder.item?.length ?? 0),
      0
    );
    expect(requestCount).toBe(TESTRAIL_V2_SUPPORTED.length);
  });
});
