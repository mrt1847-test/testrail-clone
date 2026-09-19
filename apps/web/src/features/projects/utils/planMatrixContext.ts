export type PlanMatrixOwner = {
  id: string;
  name: string;
};

export function resolvePlanMatrixOwner<T extends PlanMatrixOwner>(
  entries: readonly T[],
  selectedEntryIds: readonly string[]
): T | null {
  if (selectedEntryIds.length !== 1) return null;
  return entries.find((entry) => entry.id === selectedEntryIds[0]) ?? null;
}

export function planMatrixSavePayload(
  ownerId: string | null,
  loadedEntryId: string | null,
  configurationIds: readonly string[]
): { entryId: string; configurationIds: string[] } | null {
  if (!ownerId || !loadedEntryId || ownerId !== loadedEntryId) return null;
  return { entryId: ownerId, configurationIds: [...configurationIds] };
}
