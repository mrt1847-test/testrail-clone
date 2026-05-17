import { describe, expect, it } from "vitest";

import { AppError } from "../common/errors/appError.js";
import {
  attachmentRetentionCutoff,
  attachmentRetentionPolicySummary,
  resolveAttachmentRetentionDays
} from "./attachmentRetentionPolicy.js";

describe("attachmentRetentionPolicy", () => {
  it("resolves default retention days", () => {
    expect(resolveAttachmentRetentionDays()).toBeGreaterThanOrEqual(30);
  });

  it("rejects out-of-range retention", () => {
    expect(() => resolveAttachmentRetentionDays(7)).toThrow(AppError);
    expect(() => resolveAttachmentRetentionDays(99999)).toThrow(AppError);
  });

  it("computes cutoff in the past", () => {
    const cutoff = attachmentRetentionCutoff(90);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it("exposes policy summary for settings UI", () => {
    const summary = attachmentRetentionPolicySummary();
    expect(summary.minRetentionDays).toBeLessThanOrEqual(summary.defaultRetentionDays);
    expect(summary.pruneBatchSize).toBeGreaterThan(0);
  });
});
