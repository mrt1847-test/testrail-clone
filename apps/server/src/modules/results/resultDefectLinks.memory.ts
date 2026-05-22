export type InMemoryResultDefectLink = {
  id: bigint;
  resultId: bigint;
  defectKey: string;
  url: string | null;
  remoteStatus: string | null;
  remoteStatusLabel: string | null;
  remoteStatusSyncedAt: Date | null;
  providerIssueId: string | null;
  createMode: string | null;
  createdAt: Date;
};

const linksByResultId = new Map<string, InMemoryResultDefectLink[]>();
let linkSeq = 1n;

export function listInMemoryResultDefectLinks(resultId: bigint): InMemoryResultDefectLink[] {
  return [...(linksByResultId.get(resultId.toString()) ?? [])].sort((a, b) =>
    a.id < b.id ? 1 : -1
  );
}

export function findInMemoryResultDefectLink(resultId: bigint, defectLinkId: bigint) {
  return listInMemoryResultDefectLinks(resultId).find((row) => row.id === defectLinkId) ?? null;
}

export function upsertInMemoryResultDefectLink(input: {
  resultId: bigint;
  defectKey: string;
  url: string | null;
  remoteStatus?: string | null;
  remoteStatusLabel?: string | null;
  remoteStatusSyncedAt?: Date | null;
  providerIssueId?: string | null;
  createMode?: string | null;
}): InMemoryResultDefectLink {
  const key = input.resultId.toString();
  const rows = linksByResultId.get(key) ?? [];
  const existing = rows.find((row) => row.defectKey === input.defectKey);
  if (existing) {
    existing.url = input.url;
    existing.remoteStatus = input.remoteStatus ?? existing.remoteStatus;
    existing.remoteStatusLabel = input.remoteStatusLabel ?? existing.remoteStatusLabel;
    existing.remoteStatusSyncedAt = input.remoteStatusSyncedAt ?? existing.remoteStatusSyncedAt;
    existing.providerIssueId = input.providerIssueId ?? existing.providerIssueId;
    existing.createMode = input.createMode ?? existing.createMode;
    return existing;
  }
  const created: InMemoryResultDefectLink = {
    id: linkSeq++,
    resultId: input.resultId,
    defectKey: input.defectKey,
    url: input.url,
    remoteStatus: input.remoteStatus ?? null,
    remoteStatusLabel: input.remoteStatusLabel ?? null,
    remoteStatusSyncedAt: input.remoteStatusSyncedAt ?? null,
    providerIssueId: input.providerIssueId ?? null,
    createMode: input.createMode ?? null,
    createdAt: new Date()
  };
  rows.push(created);
  linksByResultId.set(key, rows);
  return created;
}

export function listAllInMemoryResultDefectLinks(): InMemoryResultDefectLink[] {
  const out: InMemoryResultDefectLink[] = [];
  for (const rows of linksByResultId.values()) {
    out.push(...rows);
  }
  return out;
}

export function updateInMemoryResultDefectLinkStatus(
  resultId: bigint,
  defectLinkId: bigint,
  input: {
    remoteStatus: string;
    remoteStatusLabel: string;
    remoteStatusSyncedAt: Date;
  }
): InMemoryResultDefectLink | null {
  const row = findInMemoryResultDefectLink(resultId, defectLinkId);
  if (!row) return null;
  row.remoteStatus = input.remoteStatus;
  row.remoteStatusLabel = input.remoteStatusLabel;
  row.remoteStatusSyncedAt = input.remoteStatusSyncedAt;
  return row;
}
