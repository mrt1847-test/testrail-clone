/** Dev/test blob store for attachment import/export when object storage bytes are inlined. */
const blobs = new Map<string, Buffer>();

export function putLocalAttachmentBlob(storagePath: string, data: Buffer) {
  blobs.set(storagePath, Buffer.from(data));
}

export function getLocalAttachmentBlob(storagePath: string): Buffer | null {
  return blobs.get(storagePath) ?? null;
}

export function clearLocalAttachmentBlobStore() {
  blobs.clear();
}

export function hasLocalAttachmentBlob(storagePath: string) {
  return blobs.has(storagePath);
}
