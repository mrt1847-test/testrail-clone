import { describe, expect, it } from "vitest";

import { normalizeCaseLabels, parseCaseLabelsCsv } from "./caseLabels.js";

describe("caseLabels", () => {
  it("deduplicates labels case-insensitively", () => {
    expect(normalizeCaseLabels(["smoke", " Smoke ", "checkout", ""])).toEqual(["smoke", "checkout"]);
  });

  it("parses comma-separated label cells", () => {
    expect(parseCaseLabelsCsv("smoke, checkout;regression")).toEqual(["smoke", "checkout", "regression"]);
  });
});
