import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCase, createCaseStep, deleteCaseStep, updateCaseStep } from "../api/catalogApi";
import { createCaseFromAuthoring } from "./createCaseFromAuthoring";
import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import type { TestCase } from "../types";

vi.mock("../api/catalogApi", () => ({
  createCase: vi.fn(),
  createCaseStep: vi.fn(),
  updateCaseStep: vi.fn(),
  deleteCaseStep: vi.fn()
}));

const createCaseMock = vi.mocked(createCase);
const createStepMock = vi.mocked(createCaseStep);

const created: TestCase = {
  id: 12,
  caseCode: "C12",
  title: "Login path",
  type: "Functional",
  priority: "High",
  automationStatus: "manual",
  estimate: "",
  references: "",
  labels: [],
  automationKey: "",
  preconditions: "",
  expectedResult: "",
  mission: "",
  goals: "",
  aiInput: "",
  aiExpectedOutput: "",
  caseTemplateId: null,
  customValues: {},
  steps: [],
  sectionId: 4,
  displayOrder: 1,
  lockVersion: 1,
  updatedAt: "",
  archivedAt: null
};

const submit = {
  title: "Login path",
  preconditions: "Browser ready",
  estimate: "",
  references: "",
  expectedResult: "",
  stepsText: "",
  draftSteps: [
    { key: "a", description: "Open", expected: "" },
    { key: "b", description: "Submit", expected: "" }
  ],
  instructionKind: "steps",
  caseType: "Functional",
  priority: "High",
  mission: "",
  goals: "",
  aiInput: "",
  aiExpectedOutput: "",
  customValues: {},
  templateId: null,
  intent: "primary"
} as CaseAuthoringSubmitInput;

describe("createCaseFromAuthoring retry", () => {
  beforeEach(() => {
    createCaseMock.mockReset();
    createStepMock.mockReset();
    vi.mocked(updateCaseStep).mockReset().mockResolvedValue(undefined);
    vi.mocked(deleteCaseStep).mockReset().mockResolvedValue(undefined);
  });

  it("does not create a second case when retrying leftover steps (CA-F04)", async () => {
    createCaseMock.mockResolvedValue(created);
    createStepMock.mockResolvedValueOnce(40).mockRejectedValueOnce(new Error("step 2 failed"));
    const first = await createCaseFromAuthoring(4, submit);
    expect(first.ok).toBe(false);
    expect(first.caseId).toBe(12);
    expect(first.savedStepIds).toEqual([40]);
    expect(createCaseMock).toHaveBeenCalledTimes(1);

    createStepMock.mockResolvedValueOnce(41);
    const second = await createCaseFromAuthoring(4, submit, {
      caseId: 12,
      caseCode: "C12",
      created,
      bodySaved: true,
      moved: true,
      completedDrafts: first.completedDrafts,
      savedStepIds: first.savedStepIds,
      failureKind: "steps-middle"
    });
    expect(second.ok).toBe(true);
    expect(createCaseMock).toHaveBeenCalledTimes(1);
    expect(createStepMock).toHaveBeenCalledTimes(3);
    expect(second.savedStepIds).toEqual([40, 41]);
  });
});
