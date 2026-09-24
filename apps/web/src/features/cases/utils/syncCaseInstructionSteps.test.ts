import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaseStep, deleteCaseStep, updateCaseStep } from "../api/catalogApi";
import { syncCaseInstructionSteps } from "./syncCaseInstructionSteps";

vi.mock("../api/catalogApi", () => ({
  createCaseStep: vi.fn(),
  updateCaseStep: vi.fn(),
  deleteCaseStep: vi.fn()
}));

const createMock = vi.mocked(createCaseStep);
const updateMock = vi.mocked(updateCaseStep);
const deleteMock = vi.mocked(deleteCaseStep);

describe("syncCaseInstructionSteps", () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it("keeps saved step ids and leftover drafts when a middle create fails", async () => {
    createMock.mockResolvedValueOnce(40).mockRejectedValueOnce(new Error("step 2 failed"));
    const result = await syncCaseInstructionSteps(12, [], [
      { key: "a", description: "Open", expected: "" },
      { key: "b", description: "Submit", expected: "" },
      { key: "c", description: "Done", expected: "" }
    ]);
    expect(result.savedStepIds).toEqual([40]);
    expect(result.completedDrafts).toHaveLength(1);
    expect(result.pendingDrafts.map((row) => row.description)).toEqual(["Submit", "Done"]);
    expect(result.failedIndex).toBe(1);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("retries only pending drafts against existing ids", async () => {
    createMock.mockResolvedValueOnce(41).mockResolvedValueOnce(42);
    const result = await syncCaseInstructionSteps(
      12,
      [{ id: 40, description: "Open", expected: "" }],
      [
        { key: "a", id: 40, description: "Open", expected: "" },
        { key: "b", description: "Submit", expected: "" },
        { key: "c", description: "Done", expected: "" }
      ]
    );
    expect(result.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(result.savedStepIds).toEqual([40, 41, 42]);
  });
});
