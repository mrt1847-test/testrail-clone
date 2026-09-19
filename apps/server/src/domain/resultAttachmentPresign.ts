import { AppError } from "../common/errors/appError.js";

export function resultAttachmentPresignBlockReason(input: {
  hasPersistentStorage: boolean;
  resultFound: boolean;
}): AppError | null {
  if (!input.hasPersistentStorage) {
    return new AppError("STORAGE_UNAVAILABLE", "attachment storage is not available", 501);
  }
  if (!input.resultFound) {
    return new AppError("NOT_FOUND", "result not found", 404);
  }
  return null;
}
