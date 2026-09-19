import { describe, expect, it } from "vitest";

import type { CaseStep } from "../types";
import {
  convertInstructionDraft,
  draftStepsForTextPersist,
  emptyAuthoringDraftStep,
  instructionKindFromTemplateFields,
  textStepsFromPersistedSteps
} from "./caseAuthoringInstructions";

describe("caseAuthoringInstructions", () => {
  it("classifies Text and Steps templates from their field lists", () => {
    expect(instructionKindFromTemplateFields(["title", "preconditions", "expectedResult", "refs"])).toBe("text");
    expect(instructionKindFromTemplateFields(["title", "preconditions", "steps", "refs"])).toBe("steps");
    expect(instructionKindFromTemplateFields(["title", "mission", "goals"])).toBe("other");
  });

  it("reads Text steps from a single persisted case step without stealing Expected", () => {
    const steps: CaseStep[] = [{ id: 9, description: "Open the invoice PDF from the confirmation mail", expected: "-" }];
    expect(textStepsFromPersistedSteps(steps)).toBe("Open the invoice PDF from the confirmation mail");
    expect(draftStepsForTextPersist("Open the invoice PDF from the confirmation mail")).toEqual([
      expect.objectContaining({ description: "Open the invoice PDF from the confirmation mail", expected: "" })
    ]);
  });

  it("converts Text prose into one Action and keeps common Expected", () => {
    const converted = convertInstructionDraft({
      from: "text",
      to: "steps",
      stepsText: "Sign in with a valid password",
      draftSteps: [emptyAuthoringDraftStep()],
      expectedResult: "Dashboard shows the user name"
    });
    expect(converted.draftSteps).toHaveLength(1);
    expect(converted.draftSteps[0]?.description).toBe("Sign in with a valid password");
    expect(converted.expectedResult).toBe("Dashboard shows the user name");
    expect(converted.warning).toMatch(/first Action/i);
  });

  it("converts structured steps to prose and warns when per-step Expected would be dropped", () => {
    const converted = convertInstructionDraft({
      from: "steps",
      to: "text",
      stepsText: "",
      draftSteps: [
        { key: "1", description: "Enter email", expected: "Email accepted" },
        { key: "2", description: "Submit", expected: "" }
      ],
      expectedResult: "Session starts"
    });
    expect(converted.stepsText).toBe("Enter email\nSubmit");
    expect(converted.expectedResult).toBe("Session starts");
    expect(converted.warning).toMatch(/Per-step Expected/i);
  });
});
