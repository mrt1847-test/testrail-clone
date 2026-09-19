import { describe, expect, it } from "vitest";

import {
  createResultSaveLifecycle,
  legacyWouldReuseCreatedResult,
  remainingStagedAttachments,
  resolveResultSaveMode,
  resultFieldsChanged,
  shouldApplyOperationCompletion
} from "./resultSaveLifecycle";
import type { ResultSaveFeedback, ResultSaveRetryPayload } from "./resultSaveFeedback";

function file(name: string, body = "x") {
  return new File([body], name, { type: "text/plain", lastModified: 1 });
}

function payload(partial: Partial<ResultSaveRetryPayload> & Pick<ResultSaveRetryPayload, "status">): ResultSaveRetryPayload {
  return partial;
}

function ownerFeedback(overrides: Partial<ResultSaveFeedback> = {}): ResultSaveFeedback {
  const staged = [{ id: "fa", file: file("a.png") }];
  return {
    testId: "test-A",
    status: "failed",
    message: "Result saved. Couldn't attach a.png.",
    previousStatus: "untested",
    canUndo: false,
    retryPayload: payload({ status: "failed", comment: "timeout", stagedAttachments: staged }),
    createdResultId: "result-A",
    operationId: "op-1",
    kind: "create-result",
    ...overrides
  };
}

function session(options?: { failFiles?: string[]; holdFile?: string; failAssign?: boolean }) {
  const created: Array<{ testId: string; status: string; comment?: string; id: string }> = [];
  const associated: Array<{ resultId: string; fileName: string }> = [];
  const assigned: Array<{ testId: string; assignedTo: string | null }> = [];
  const currentAssignee: Record<string, string | null> = {};
  const failFiles = new Set(options?.failFiles ?? []);
  let releaseHold: (() => void) | null = null;
  const holdGate =
    options?.holdFile != null
      ? new Promise<void>((resolve) => {
          releaseHold = resolve;
        })
      : null;
  const lifecycle = createResultSaveLifecycle({
    resolvePreviousStatus: () => "untested",
    resolveAssignedTo: (testId) => currentAssignee[testId] ?? null,
    assignTest: async (testId, assignedTo) => {
      assigned.push({ testId, assignedTo });
      if (options?.failAssign) throw new Error("assign failed");
      currentAssignee[testId] = assignedTo;
    },
    createResult: async ({ testId, status, comment }) => {
      const id = `result-${testId}-${created.length + 1}`;
      created.push({ testId, status, comment, id });
      return { id };
    },
    associateAttachment: async (resultId, uploaded) => {
      if (options?.holdFile === uploaded.name && holdGate) await holdGate;
      associated.push({ resultId, fileName: uploaded.name });
      if (failFiles.has(uploaded.name)) throw new Error(`attach ${uploaded.name} failed`);
    }
  });
  return {
    lifecycle,
    created,
    associated,
    assigned,
    failFiles,
    releaseHold: () => releaseHold?.()
  };
}

describe("legacyWouldReuseCreatedResult", () => {
  it("reproduces the cross-test attach leak in the old RunDetailPage condition", () => {
    const feedback = { status: "failed", createdResultId: "result-A", testId: "test-A" };
    expect(legacyWouldReuseCreatedResult(feedback, 1)).toBe(true);
    expect(
      resolveResultSaveMode({
        feedback: ownerFeedback(),
        submittingTestId: "test-B",
        payload: payload({ status: "passed", stagedAttachments: [{ id: "fb", file: file("b.png") }] }),
        remainingFiles: [{ id: "fb", file: file("b.png") }]
      })
    ).toBe("create-result");
  });
});

describe("resolveResultSaveMode", () => {
  it("retries attachments only for the owning test when result fields are unchanged", () => {
    expect(
      resolveResultSaveMode({
        feedback: ownerFeedback(),
        submittingTestId: "test-A",
        payload: ownerFeedback().retryPayload,
        remainingFiles: [{ id: "fa", file: file("a.png") }]
      })
    ).toBe("attach-only");
  });

  it("creates a new result when status or comment changed after partial success", () => {
    expect(
      resolveResultSaveMode({
        feedback: ownerFeedback(),
        submittingTestId: "test-A",
        payload: payload({
          status: "passed",
          comment: "now passing",
          stagedAttachments: [{ id: "fa", file: file("a.png") }]
        }),
        remainingFiles: [{ id: "fa", file: file("a.png") }]
      })
    ).toBe("create-result");
  });

  it("does not recreate a result when remaining files were removed", () => {
    expect(
      resolveResultSaveMode({
        feedback: ownerFeedback(),
        submittingTestId: "test-A",
        payload: payload({ status: "failed", comment: "timeout" }),
        remainingFiles: []
      })
    ).toBe("noop-saved");
  });

  it("retries assignment only when a pending assignee remains", () => {
    expect(
      resolveResultSaveMode({
        feedback: ownerFeedback({
          pendingAssignment: "u1",
          retryPayload: payload({ status: "failed", comment: "timeout", assignedTo: "u1" })
        }),
        submittingTestId: "test-A",
        payload: payload({ status: "failed", comment: "timeout", assignedTo: "u1" }),
        remainingFiles: []
      })
    ).toBe("assign-only");
  });
});

describe("resultFieldsChanged", () => {
  it("ignores attachment identity when comparing result fields", () => {
    expect(
      resultFieldsChanged(
        payload({ status: "failed", comment: "timeout", stagedAttachments: [{ id: "fa", file: file("a.png") }] }),
        payload({ status: "failed", comment: "timeout", stagedAttachments: [{ id: "fb", file: file("b.png") }] })
      )
    ).toBe(false);
    expect(
      resultFieldsChanged(
        payload({ status: "failed", comment: "timeout" }),
        payload({ status: "passed", comment: "timeout" })
      )
    ).toBe(true);
  });
});

describe("shouldApplyOperationCompletion", () => {
  it("ignores late completions from a superseded operation", () => {
    expect(shouldApplyOperationCompletion("op-2", "op-1")).toBe(false);
    expect(shouldApplyOperationCompletion("op-2", "op-2")).toBe(true);
  });
});

describe("remainingStagedAttachments", () => {
  it("drops uploaded and discarded files from retry payloads", () => {
    const leftover = remainingStagedAttachments(
      payload({
        status: "failed",
        stagedAttachments: [
          { id: "ok", file: file("ok.png") },
          { id: "bad", file: file("bad.png") },
          { id: "gone", file: file("gone.png") }
        ]
      }),
      { ok: { status: "uploaded", progress: 100 } },
      new Set(["gone"])
    );
    expect(leftover.map((row) => row.id)).toEqual(["bad"]);
  });
});

describe("createResultSaveLifecycle", () => {
  it("does not attach B's file to A's result after A attachment failure", async () => {
    const { lifecycle, created, associated } = session({ failFiles: ["a.png"] });
    await expect(
      lifecycle.submit("test-A", payload({ status: "failed", stagedAttachments: [{ id: "fa", file: file("a.png") }] }))
    ).rejects.toThrow(/Couldn't attach a\.png/);
    expect(created.map((row) => ({ testId: row.testId, id: row.id }))).toEqual([
      { testId: "test-A", id: "result-test-A-1" }
    ]);
    expect(associated).toEqual([{ resultId: "result-test-A-1", fileName: "a.png" }]);
    expect(lifecycle.feedbackFor("test-A")?.message).toBe("Result saved. Couldn't attach a.png.");

    await lifecycle.submit("test-B", payload({ status: "passed", stagedAttachments: [{ id: "fb", file: file("b.png") }] }));
    expect(created.map((row) => row.testId)).toEqual(["test-A", "test-B"]);
    expect(associated).toEqual([
      { resultId: "result-test-A-1", fileName: "a.png" },
      { resultId: "result-test-B-2", fileName: "b.png" }
    ]);
    expect(lifecycle.feedbackFor("test-A")?.createdResultId).toBe("result-test-A-1");
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("failed");
    expect(lifecycle.feedbackFor("test-B")?.createdResultId).toBe("result-test-B-2");
    expect(lifecycle.feedbackFor("test-B")?.status).toBe("saved");
  });

  it("retries the owning result after navigation without creating a duplicate", async () => {
    const { lifecycle, created, associated, failFiles } = session({ failFiles: ["a.png"] });
    await expect(
      lifecycle.submit("test-A", payload({ status: "failed", stagedAttachments: [{ id: "fa", file: file("a.png") }] }))
    ).rejects.toThrow();
    await lifecycle.submit("test-B", payload({ status: "passed" }));
    failFiles.delete("a.png");
    await lifecycle.retry("test-A");
    expect(created.map((row) => row.id)).toEqual(["result-test-A-1", "result-test-B-2"]);
    expect(associated.filter((row) => row.fileName === "a.png").map((row) => row.resultId)).toEqual([
      "result-test-A-1",
      "result-test-A-1"
    ]);
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("saved");
  });

  it("does not reupload an already successful file when one of two files failed", async () => {
    const { lifecycle, associated, failFiles } = session({ failFiles: ["bad.png"] });
    const ok = file("ok.png");
    const bad = file("bad.png");
    await expect(
      lifecycle.submit(
        "test-A",
        payload({
          status: "failed",
          stagedAttachments: [
            { id: "ok", file: ok },
            { id: "bad", file: bad }
          ]
        })
      )
    ).rejects.toThrow(/Couldn't attach bad\.png/);
    expect(associated.map((row) => row.fileName)).toEqual(["ok.png", "bad.png"]);
    failFiles.delete("bad.png");
    await lifecycle.retry("test-A");
    expect(associated.map((row) => row.fileName)).toEqual(["ok.png", "bad.png", "bad.png"]);
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("saved");
  });

  it("invalidates a removed file so retry cannot resurrect it", async () => {
    const { lifecycle, associated, failFiles } = session({ failFiles: ["a.png"] });
    await expect(
      lifecycle.submit("test-A", payload({ status: "failed", stagedAttachments: [{ id: "fa", file: file("a.png") }] }))
    ).rejects.toThrow();
    lifecycle.discardStagedFile("test-A", "fa");
    failFiles.delete("a.png");
    await lifecycle.retry("test-A");
    expect(associated.filter((row) => row.fileName === "a.png")).toHaveLength(1);
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("saved");
    expect(lifecycle.feedbackFor("test-A")?.message).toBe("Result saved");
  });

  it("cancel after partial success keeps the created result and drops retry files", async () => {
    const { lifecycle, created, associated } = session({ failFiles: ["a.png"] });
    await expect(
      lifecycle.submit("test-A", payload({ status: "failed", stagedAttachments: [{ id: "fa", file: file("a.png") }] }))
    ).rejects.toThrow();
    lifecycle.cancel("test-A");
    await lifecycle.retry("test-A");
    expect(created).toHaveLength(1);
    expect(associated).toHaveLength(1);
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("saved");
  });

  it("submits edited result fields as a new result instead of an attachment-only retry", async () => {
    const { lifecycle, created, associated } = session({ failFiles: ["a.png"] });
    await expect(
      lifecycle.submit(
        "test-A",
        payload({ status: "failed", comment: "timeout", stagedAttachments: [{ id: "fa", file: file("a.png") }] })
      )
    ).rejects.toThrow();
    await lifecycle.submit(
      "test-A",
      payload({ status: "passed", comment: "fixed", stagedAttachments: [{ id: "fa", file: file("a.png") }] })
    ).catch(() => undefined);
    expect(created.map((row) => ({ status: row.status, comment: row.comment }))).toEqual([
      { status: "failed", comment: "timeout" },
      { status: "passed", comment: "fixed" }
    ]);
    expect(associated.map((row) => row.resultId)).toEqual(["result-test-A-1", "result-test-A-2"]);
  });

  it("does not let a late A completion overwrite B's save feedback", async () => {
    const { lifecycle, releaseHold } = session({ failFiles: ["slow.png"], holdFile: "slow.png" });
    const pendingA = lifecycle.submit(
      "test-A",
      payload({ status: "failed", stagedAttachments: [{ id: "fa", file: file("slow.png") }] })
    );
    await Promise.resolve();
    await lifecycle.submit("test-B", payload({ status: "passed" }));
    expect(lifecycle.feedbackFor("test-B")?.status).toBe("saved");
    releaseHold();
    await expect(pendingA).rejects.toThrow();
    expect(lifecycle.feedbackFor("test-B")?.status).toBe("saved");
    expect(lifecycle.feedbackFor("test-B")?.testId).toBe("test-B");
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("failed");
    expect(lifecycle.feedbackFor("test-A")?.message).toMatch(/slow\.png/);
  });

  it("does not mark the save complete or return advanced when storage is unavailable", async () => {
    const lifecycle = createResultSaveLifecycle({
      resolvePreviousStatus: () => "untested",
      createResult: async () => ({ id: "result-1" }),
      associateAttachment: async () => {
        throw new Error("Couldn't store the file. Attachment storage isn't available.");
      }
    });
    await expect(
      lifecycle.submit(
        "test-A",
        payload({ status: "passed", stagedAttachments: [{ id: "fa", file: file("bytes-proof.bin") }] }),
        { advanceOnPass: true, advanceToTestId: "test-B" }
      )
    ).rejects.toThrow(/Couldn't attach bytes-proof\.bin/);
    expect(lifecycle.feedbackFor("test-A")?.status).toBe("failed");
    expect(lifecycle.feedbackFor("test-A")?.createdResultId).toBe("result-1");
    expect(lifecycle.feedbackFor("test-A")?.message).toBe("Result saved. Couldn't attach bytes-proof.bin.");
  });

  it("assigns after a successful result and does not assign when createResult fails", async () => {
    const { lifecycle, created, assigned } = session();
    await lifecycle.submit("test-A", payload({ status: "passed", assignedTo: "u1" }));
    expect(created).toHaveLength(1);
    expect(assigned).toEqual([{ testId: "test-A", assignedTo: "u1" }]);

    const failing = createResultSaveLifecycle({
      resolvePreviousStatus: () => "untested",
      assignTest: async () => {
        throw new Error("should not assign");
      },
      createResult: async () => {
        throw new Error("result failed");
      },
      associateAttachment: async () => undefined
    });
    await expect(failing.submit("test-A", payload({ status: "failed", assignedTo: "u1" }))).rejects.toThrow(/result failed/);
    expect(failing.feedbackFor("test-A")?.createdResultId ?? null).toBe(null);
  });

  it("retries assignment only after a partial assignee failure", async () => {
    const { lifecycle, created, assigned } = session({ failAssign: true });
    await expect(lifecycle.submit("test-A", payload({ status: "passed", assignedTo: "u1" }))).rejects.toThrow(
      /Couldn't change assignee/
    );
    expect(created).toHaveLength(1);
    expect(assigned).toEqual([{ testId: "test-A", assignedTo: "u1" }]);
    expect(lifecycle.feedbackFor("test-A")?.createdResultId).toBe("result-test-A-1");
    expect(lifecycle.feedbackFor("test-A")?.pendingAssignment).toBe("u1");

    let assignShouldFail = true;
    const assignedRetry: Array<{ testId: string; assignedTo: string | null }> = [];
    const createdRetry: string[] = [];
    const retrying = createResultSaveLifecycle({
      resolvePreviousStatus: () => "untested",
      resolveAssignedTo: () => null,
      assignTest: async (testId, assignedTo) => {
        assignedRetry.push({ testId, assignedTo });
        if (assignShouldFail) throw new Error("assign failed");
      },
      createResult: async () => {
        const id = `result-${createdRetry.length + 1}`;
        createdRetry.push(id);
        return { id };
      },
      associateAttachment: async () => undefined
    });
    await expect(retrying.submit("test-A", payload({ status: "passed", assignedTo: "u1" }))).rejects.toThrow(
      /Couldn't change assignee/
    );
    expect(createdRetry).toEqual(["result-1"]);
    assignShouldFail = false;
    await retrying.retry("test-A");
    expect(createdRetry).toEqual(["result-1"]);
    expect(assignedRetry).toEqual([
      { testId: "test-A", assignedTo: "u1" },
      { testId: "test-A", assignedTo: "u1" }
    ]);
    expect(retrying.feedbackFor("test-A")?.status).toBe("saved");
  });
});
