import { describe, expect, it } from "vitest";

import { AppError } from "../common/errors/appError.js";
import {
  assertAttachmentStoragePathAllowed,
  buildAttachmentStoragePath,
  createSignedDownloadTarget,
  isTombstonedStoragePath,
  tombstoneStoragePath
} from "./attachmentStorage.js";

describe("attachmentStorage", () => {
  const projectId = 7n;
  const caseId = 42n;

  it("builds project-scoped storage keys", () => {
    const path = buildAttachmentStoragePath({
      projectId,
      entity: "cases",
      entityId: caseId,
      fileName: "spec.pdf",
      nonce: 1000
    });
    expect(path).toBe("projects/7/cases/42/1000-spec.pdf");
  });

  it("allows canonical and legacy prefixes", () => {
    const canonical = buildAttachmentStoragePath({
      projectId,
      entity: "cases",
      entityId: caseId,
      fileName: "a.png",
      nonce: 1
    });
    expect(() =>
      assertAttachmentStoragePathAllowed({
        projectId,
        entity: "cases",
        entityId: caseId,
        storagePath: canonical
      })
    ).not.toThrow();

    expect(() =>
      assertAttachmentStoragePathAllowed({
        projectId,
        entity: "cases",
        entityId: caseId,
        storagePath: `cases/${caseId}/legacy.png`
      })
    ).not.toThrow();
  });

  it("rejects cross-entity storage paths", () => {
    expect(() =>
      assertAttachmentStoragePathAllowed({
        projectId,
        entity: "cases",
        entityId: caseId,
        storagePath: "projects/7/cases/99/file.png"
      })
    ).toThrow(AppError);
  });

  it("tombstones paths and blocks download", () => {
    const tombstoned = tombstoneStoragePath("projects/7/cases/42/file.png");
    expect(isTombstonedStoragePath(tombstoned)).toBe(true);
    expect(() => createSignedDownloadTarget(tombstoned)).toThrow(AppError);
  });
});
