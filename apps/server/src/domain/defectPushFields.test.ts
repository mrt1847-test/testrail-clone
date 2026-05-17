import { describe, expect, it } from "vitest";

import {
  buildDefaultDefectPushValues,
  defectPushFieldsForProvider,
  mapDefectPushValuesToPayload,
  validateDefectPushValues
} from "./defectPushFields.js";

const context = {
  projectId: "1",
  runId: "2",
  runName: "Sprint run",
  testId: "3",
  testTitle: "Login works",
  resultId: "99",
  resultStatus: "failed",
  resultComment: "Assertion error"
};

describe("defectPushFields", () => {
  it("returns provider-specific field sets", () => {
    expect(defectPushFieldsForProvider("jira").some((field) => field.key === "issueType")).toBe(true);
    expect(defectPushFieldsForProvider("github").some((field) => field.key === "labels")).toBe(true);
  });

  it("prefills traceback in description", () => {
    const fields = defectPushFieldsForProvider("jira");
    const values = buildDefaultDefectPushValues(fields, context, "QA");
    expect(values.summary).toContain("Login works");
    expect(values.description).toContain("resultId=99");
    expect(values.defectKey).toBe("QA-");
  });

  it("maps values to push payload with custom fields", () => {
    const fields = defectPushFieldsForProvider("jira");
    const values = buildDefaultDefectPushValues(fields, context, "QA");
    values.summary = "Broken login";
    values.issueType = "Bug";
    values.priority = "High";
    const payload = mapDefectPushValuesToPayload("jira", fields, values);
    expect(payload.title).toBe("Broken login");
    expect(payload.customFields.issueType).toBe("Bug");
    expect(validateDefectPushValues(fields, values)).toHaveLength(0);
  });
});
