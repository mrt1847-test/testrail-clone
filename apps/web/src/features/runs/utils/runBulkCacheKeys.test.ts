import { describe, expect, it } from "vitest";

import { bulkResultCacheQueryKeys } from "./runBulkCacheKeys";

describe("bulkResultCacheQueryKeys", () => {
  it("includes grouped instances so list STATUS refreshes without reload", () => {
    const keys = bulkResultCacheQueryKeys("2", "1");
    expect(keys).toContainEqual(["runs", "2", "detail", "1"]);
    expect(keys).toContainEqual(["runs", "2", "instances", "1"]);
    expect(keys).toContainEqual(["runs", "2", "instances-grouped", "1"]);
    expect(keys).toContainEqual(["runs", "2", "list"]);
  });
});
