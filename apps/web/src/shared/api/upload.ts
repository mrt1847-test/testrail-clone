import { API_BASE, getAccessToken } from "./http";

type PresignedUpload = {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
};

type UploadOptions = {
  contentType?: string;
  onProgress?: (progress: number) => void;
};

export function uploadFileToPresignedUrl(file: File, presign: PresignedUpload, options: UploadOptions = {}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(presign.method, presign.uploadUrl);

    const headers: Record<string, string> = {
      ...(presign.headers ?? {})
    };
    if (options.contentType && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["Content-Type"] = options.contentType;
    }
    const accessToken = getAccessToken();
    if (accessToken && presign.uploadUrl.startsWith(API_BASE)) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error("attachment upload failed"));
    };
    xhr.onerror = () => reject(new Error("attachment upload failed"));
    xhr.send(file);
  });
}
