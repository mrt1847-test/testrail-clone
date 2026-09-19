import { apiFetch } from "../../../shared/api/http";
import { uploadFileToPresignedUrl } from "../../../shared/api/upload";
import {
  attachmentStorageUnavailableMessage,
  isAttachmentStorageUnavailable
} from "../utils/resultComposerModel";

type PresignAttachmentResponse = {
  data: {
    storagePath: string;
    uploadUrl: string;
    method: "PUT" | "POST";
    headers?: Record<string, string>;
    expiresAt: string;
  };
};

export async function uploadResultAttachmentViaPresign(
  resultId: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  let presign: PresignAttachmentResponse;
  try {
    presign = await apiFetch<PresignAttachmentResponse>(`/api/results/${resultId}/attachments/presign`, {
      method: "POST",
      body: {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: String(file.size)
      }
    });
  } catch (error) {
    if (isAttachmentStorageUnavailable(error)) {
      throw new Error(attachmentStorageUnavailableMessage());
    }
    throw error;
  }
  await uploadFileToPresignedUrl(file, presign.data, {
    contentType: file.type || "application/octet-stream",
    onProgress
  });

  return apiFetch(`/api/attachments`, {
    method: "POST",
    body: {
      resultId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      storagePath: presign.data.storagePath,
      fileSize: String(file.size)
    }
  });
}

export async function associateResultAttachment(
  resultId: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  return uploadResultAttachmentViaPresign(resultId, file, onProgress);
}
