import { describe, expect, it } from "vitest";

import { AppError } from "../common/errors/appError.js";
import { resultAttachmentPresignBlockReason } from "./resultAttachmentPresign.js";

describe("resultAttachmentPresignBlockReason", () => {
  it("rejects unsupported memory mode instead of pretending the result is missing", () => {
    const error = resultAttachmentPresignBlockReason({ hasPersistentStorage: false, resultFound: true });
    expect(error).toBeInstanceOf(AppError);
    expect(error?.code).toBe("STORAGE_UNAVAILABLE");
    expect(error?.statusCode).toBe(501);
  });

  it("keeps a missing result as NOT_FOUND when storage exists", () => {
    const error = resultAttachmentPresignBlockReason({ hasPersistentStorage: true, resultFound: false });
    expect(error?.code).toBe("NOT_FOUND");
    expect(error?.statusCode).toBe(404);
    expect(error?.message).toBe("result not found");
  });

  it("allows presign when storage and the result both exist", () => {
    expect(resultAttachmentPresignBlockReason({ hasPersistentStorage: true, resultFound: true })).toBeNull();
  });
});
