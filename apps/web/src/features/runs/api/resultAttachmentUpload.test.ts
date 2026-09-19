import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../../../shared/api/http";
import { uploadFileToPresignedUrl } from "../../../shared/api/upload";
import { associateResultAttachment } from "./resultAttachmentUpload";

vi.mock("../../../shared/api/http", () => ({
  apiFetch: vi.fn()
}));

vi.mock("../../../shared/api/upload", () => ({
  uploadFileToPresignedUrl: vi.fn()
}));

const apiFetchMock = vi.mocked(apiFetch);
const uploadMock = vi.mocked(uploadFileToPresignedUrl);

function file(name = "bytes-proof.bin") {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "application/octet-stream" });
}

describe("associateResultAttachment", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    uploadMock.mockReset();
  });

  it("does not register metadata-only success when storage is unavailable", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new Error('{"error":{"code":"STORAGE_UNAVAILABLE","message":"attachment storage is not available"}}')
    );
    await expect(associateResultAttachment("1", file())).rejects.toThrow(
      "Couldn't store the file. Attachment storage isn't available."
    );
    expect(uploadMock).not.toHaveBeenCalled();
    expect(apiFetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/results/1/attachments/presign"]);
  });

  it("does not convert a missing result 404 into attached metadata", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new Error('{"error":{"code":"NOT_FOUND","message":"result not found"}}')
    );
    await expect(associateResultAttachment("99", file())).rejects.toThrow(/result not found/);
    expect(apiFetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/results/99/attachments/presign"]);
  });

  it("surfaces upload failure before association", async () => {
    apiFetchMock.mockResolvedValueOnce({
      data: {
        storagePath: "projects/1/results/1/proof.bin",
        uploadUrl: "https://storage.example/upload/proof.bin",
        method: "PUT",
        expiresAt: "2099-01-01T00:00:00.000Z"
      }
    });
    uploadMock.mockRejectedValueOnce(new Error("attachment upload failed"));
    await expect(associateResultAttachment("1", file())).rejects.toThrow("attachment upload failed");
    expect(apiFetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/results/1/attachments/presign"]);
  });

  it("surfaces association failure after a successful upload", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        data: {
          storagePath: "projects/1/results/1/proof.bin",
          uploadUrl: "https://storage.example/upload/proof.bin",
          method: "PUT",
          expiresAt: "2099-01-01T00:00:00.000Z"
        }
      })
      .mockRejectedValueOnce(new Error("register attachment failed"));
    uploadMock.mockResolvedValueOnce(undefined);
    await expect(associateResultAttachment("1", file())).rejects.toThrow("register attachment failed");
    expect(uploadMock).toHaveBeenCalledOnce();
    expect(apiFetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/results/1/attachments/presign",
      "/api/attachments"
    ]);
  });

  it("registers the presigned storage path after bytes upload, not a local:// fallback", async () => {
    const stored = new Uint8Array([1, 2, 3, 4]);
    apiFetchMock
      .mockResolvedValueOnce({
        data: {
          storagePath: "projects/1/results/1/proof.bin",
          uploadUrl: "https://storage.example/upload/proof.bin",
          method: "PUT",
          expiresAt: "2099-01-01T00:00:00.000Z"
        }
      })
      .mockResolvedValueOnce({ data: { id: "att-1", fileName: "bytes-proof.bin" } });
    uploadMock.mockImplementationOnce(async (uploaded) => {
      expect(new Uint8Array(await uploaded.arrayBuffer())).toEqual(stored);
    });
    await associateResultAttachment("1", file());
    expect(apiFetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: {
        resultId: "1",
        fileName: "bytes-proof.bin",
        storagePath: "projects/1/results/1/proof.bin"
      }
    });
  });
});
