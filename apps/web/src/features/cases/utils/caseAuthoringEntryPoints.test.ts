import { describe, expect, it } from "vitest";

import {
  FULL_AUTHORING_PRIMARY_LABEL,
  QUICK_OUTLINE_SECTION_LABEL,
  caseAuthoringEntryKind,
  headerPrimaryShouldOpenFullForm,
  shouldOmitFullAuthoringFromOverflow
} from "./caseAuthoringEntryPoints";
import { sectionBlockAddCaseLabel } from "./caseListRowPresentation";

describe("caseAuthoringEntryPoints (CA-U01 / UI-069)", () => {
  it("keeps the header primary label as full authoring", () => {
    expect(FULL_AUTHORING_PRIMARY_LABEL).toBe("Add Test Case");
    expect(headerPrimaryShouldOpenFullForm(FULL_AUTHORING_PRIMARY_LABEL)).toBe(true);
    expect(headerPrimaryShouldOpenFullForm(QUICK_OUTLINE_SECTION_LABEL)).toBe(false);
    expect(caseAuthoringEntryKind({ label: FULL_AUTHORING_PRIMARY_LABEL, opensFullForm: true })).toBe(
      "full-form"
    );
  });

  it("keeps section Add Case as the quiet title-only path", () => {
    expect(QUICK_OUTLINE_SECTION_LABEL).toBe("Add Case");
    expect(sectionBlockAddCaseLabel("Login")).toBe("Add Case to Login");
    expect(caseAuthoringEntryKind({ label: QUICK_OUTLINE_SECTION_LABEL, opensFullForm: false })).toBe(
      "title-outline"
    );
  });

  it("drops the duplicate full-authoring item from More actions once the header owns it", () => {
    expect(shouldOmitFullAuthoringFromOverflow({ headerPrimaryIsFullForm: true })).toBe(true);
    expect(shouldOmitFullAuthoringFromOverflow({ headerPrimaryIsFullForm: false })).toBe(false);
  });
});
