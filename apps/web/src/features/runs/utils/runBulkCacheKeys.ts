import { runKeys } from "../hooks/useRunsApi";

/** Query prefixes that must refresh after a successful bulk result apply. */
export function bulkResultCacheQueryKeys(projectId: string, runId: string) {
  return [
    runKeys.detail(projectId, runId),
    runKeys.instancesPrefix(projectId, runId),
    [...runKeys.all(projectId), "instances-grouped", runId] as const,
    runKeys.list(projectId)
  ] as const;
}
