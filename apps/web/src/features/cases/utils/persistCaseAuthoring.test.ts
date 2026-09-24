import { describe, expect, it, vi, beforeEach } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import type { TestCase } from "../types";
import { emptyAuthoringOutcome } from "./authoringPersistOutcome";
import { createAndRefreshCaseAuthoring, persistAndRefreshCaseAuthoring } from "./persistCaseAuthoring";
import { createCaseFromAuthoring } from "./createCaseFromAuthoring";
import { updateCaseFromAuthoring } from "./updateCaseFromAuthoring";

vi.mock("./updateCaseFromAuthoring", () => ({
  updateCaseFromAuthoring: vi.fn()
}));

vi.mock("./createCaseFromAuthoring", () => ({
  createCaseFromAuthoring: vi.fn()
}));

const updateMock = vi.mocked(updateCaseFromAuthoring);
const createMock = vi.mocked(createCaseFromAuthoring);

const existing: TestCase = {
  id: 9,
  caseCode: "C9",
  title: "Outline",
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
  title: "Outline",
  preconditions: "",
  estimate: "",
  references: "",
  expectedResult: "",
  stepsText: "Open login",
  draftSteps: [],
  instructionKind: "text",
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

function queryClient() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined)
  } as unknown as QueryClient & { invalidateQueries: ReturnType<typeof vi.fn> };
}

describe("persistAndRefreshCaseAuthoring", () => {
  beforeEach(() => {
    updateMock.mockReset();
    createMock.mockReset();
  });

  it("does not refresh while steps are still incomplete (CA-F03)", async () => {
    updateMock.mockResolvedValue(
      emptyAuthoringOutcome({
        ok: false,
        caseId: 9,
        caseCode: "C9",
        bodySaved: true,
        moved: true,
        stepsComplete: false,
        failureKind: "steps-first",
        stepsWarning: "Could not save steps."
      })
    );
    const qc = queryClient();
    const result = await persistAndRefreshCaseAuthoring(qc, {
      projectId: "1",
      existing,
      sectionId: 4,
      submit,
      saveGeneration: 1
    });
    expect(result.ok).toBe(false);
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it("refreshes once after body and steps both complete", async () => {
    updateMock.mockResolvedValue(
      emptyAuthoringOutcome({
        ok: true,
        caseId: 9,
        caseCode: "C9",
        bodySaved: true,
        moved: true,
        stepsComplete: true,
        failureKind: null,
        message: null
      })
    );
    const qc = queryClient();
    await persistAndRefreshCaseAuthoring(qc, {
      projectId: "1",
      existing,
      sectionId: 4,
      submit,
      saveGeneration: 2
    });
    expect(qc.invalidateQueries).toHaveBeenCalled();
  });

  it("does not let a late A refresh replace B", async () => {
    updateMock.mockResolvedValue(
      emptyAuthoringOutcome({
        ok: true,
        caseId: 9,
        caseCode: "C9",
        bodySaved: true,
        moved: true,
        stepsComplete: true,
        failureKind: null,
        message: null
      })
    );
    const qc = queryClient();
    await persistAndRefreshCaseAuthoring(qc, {
      projectId: "1",
      existing,
      sectionId: 4,
      submit,
      saveGeneration: 1,
      isCurrent: () => false
    });
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("createAndRefreshCaseAuthoring", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("holds the list refresh until create steps finish", async () => {
    createMock.mockResolvedValue(
      emptyAuthoringOutcome({
        ok: false,
        created: existing,
        caseId: 9,
        caseCode: "C9",
        bodySaved: true,
        failureKind: "steps-first",
        stepsWarning: "Could not save steps."
      })
    );
    const qc = queryClient();
    await createAndRefreshCaseAuthoring(qc, {
      projectId: "1",
      sectionId: 4,
      submit,
      saveGeneration: 1
    });
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });
});
