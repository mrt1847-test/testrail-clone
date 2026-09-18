export type InMemoryResultAttachment = {
  id: bigint;
  resultId: bigint;
  fileName: string;
  contentType: string | null;
  storagePath: string;
  fileSize: string | null;
  createdAt: Date;
};

const attachmentsByResultId = new Map<string, InMemoryResultAttachment[]>();
let attachmentSeq = 1n;

export function addInMemoryResultAttachment(input: {
  resultId: bigint;
  fileName: string;
  contentType?: string | null;
  storagePath?: string;
  fileSize?: string | bigint | null;
}): InMemoryResultAttachment {
  const resultId = input.resultId;
  const created: InMemoryResultAttachment = {
    id: attachmentSeq++,
    resultId,
    fileName: input.fileName,
    contentType: input.contentType ?? null,
    storagePath: input.storagePath ?? `local://results/${resultId.toString()}/${input.fileName}`,
    fileSize: input.fileSize == null ? null : String(input.fileSize),
    createdAt: new Date()
  };
  const key = resultId.toString();
  const rows = attachmentsByResultId.get(key) ?? [];
  rows.push(created);
  attachmentsByResultId.set(key, rows);
  return created;
}

export function listInMemoryResultAttachments(resultId: bigint): InMemoryResultAttachment[] {
  return [...(attachmentsByResultId.get(resultId.toString()) ?? [])].sort((a, b) => (a.id < b.id ? 1 : -1));
}
