import { describe, expect, it } from "vitest";

import { AppError } from "../../common/errors/appError.js";
import {
  buildTestRailListResponse,
  parseTestRailPagination,
  TESTRAIL_V2_MAX_LIMIT
} from "./testrail.pagination.js";

describe("testrail.pagination", () => {
  it("defaults limit and offset", () => {
    expect(parseTestRailPagination({})).toEqual({ limit: 250, offset: 0 });
  });

  it("rejects limit above max", () => {
    expect(() => parseTestRailPagination({ limit: TESTRAIL_V2_MAX_LIMIT + 1 })).toThrow(AppError);
  });

  it("builds TestRail list envelope with links", () => {
    const body = buildTestRailListResponse({
      items: [1, 2, 3, 4, 5],
      limit: 2,
      offset: 2,
      collectionKey: "cases",
      basePath: "/api/v2/get_cases/9"
    });
    expect(body).toMatchObject({
      offset: 2,
      limit: 2,
      size: 2,
      cases: [3, 4]
    });
    expect(body._links.next).toContain("offset=4");
    expect(body._links.prev).toContain("offset=0");
  });
});
