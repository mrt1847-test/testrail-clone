import { useCallback, useEffect, useMemo, useRef } from "react";

import { pruneSectionRootIds } from "../../../shared/sections/sectionCompatibility";

export type RunCompositionDraft = {
  suiteId: string;
  includedSectionIds: string[];
  excludedSectionIds: string[];
};

function storageKey(userId: string | null | undefined, projectId: string) {
  return `testrail.runComposition.${userId ?? "anonymous"}.${projectId}`;
}

function readDraft(key: string): RunCompositionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.suiteId !== "string") return null;
    return {
      suiteId: parsed.suiteId,
      includedSectionIds: Array.isArray(parsed.includedSectionIds)
        ? parsed.includedSectionIds.filter((id): id is string => typeof id === "string")
        : [],
      excludedSectionIds: Array.isArray(parsed.excludedSectionIds)
        ? parsed.excludedSectionIds.filter((id): id is string => typeof id === "string")
        : []
    };
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: RunCompositionDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(draft));
}

export function useRunCompositionDraft(
  projectId: string,
  userId: string | null | undefined,
  suiteId: string,
  includedSectionIds: string[],
  excludedSectionIds: string[],
  validSectionIds: ReadonlySet<number>
) {
  const key = useMemo(() => storageKey(userId, projectId), [projectId, userId]);
  const hydratedRef = useRef(false);
  const lastPruneMessageRef = useRef<string | null>(null);

  const loadDraftForSuite = useCallback(
    (targetSuiteId: string): RunCompositionDraft | null => {
      const draft = readDraft(key);
      if (!draft || draft.suiteId !== targetSuiteId) return null;
      if (validSectionIds.size === 0) return draft;
      const included = pruneSectionRootIds(draft.includedSectionIds, validSectionIds);
      const excluded = pruneSectionRootIds(draft.excludedSectionIds, validSectionIds);
      return {
        suiteId: targetSuiteId,
        includedSectionIds: included.nextRootIds,
        excludedSectionIds: excluded.nextRootIds
      };
    },
    [key, validSectionIds]
  );

  const persistDraft = useCallback(() => {
    if (!suiteId || typeof window === "undefined" || !hydratedRef.current) return;
    writeDraft(key, { suiteId, includedSectionIds, excludedSectionIds });
  }, [excludedSectionIds, includedSectionIds, key, suiteId]);

  useEffect(() => {
    persistDraft();
  }, [persistDraft]);

  const markHydrated = useCallback(() => {
    hydratedRef.current = true;
  }, []);

  const pruneAgainstValidSections = useCallback(
    (
      nextIncluded: string[],
      nextExcluded: string[]
    ): { included: string[]; excluded: string[]; removedCount: number; message: string | null } => {
      if (validSectionIds.size === 0) {
        return { included: nextIncluded, excluded: nextExcluded, removedCount: 0, message: null };
      }
      const included = pruneSectionRootIds(nextIncluded, validSectionIds);
      const excluded = pruneSectionRootIds(nextExcluded, validSectionIds);
      const removedCount = included.removedRootIds.length + excluded.removedRootIds.length;
      const message =
        removedCount > 0
          ? `Removed ${removedCount} section filter${removedCount === 1 ? "" : "s"} that no longer exist in this suite.`
          : null;
      if (message) lastPruneMessageRef.current = message;
      return {
        included: included.nextRootIds,
        excluded: excluded.nextRootIds,
        removedCount,
        message
      };
    },
    [validSectionIds]
  );

  const consumePruneMessage = useCallback(() => {
    const message = lastPruneMessageRef.current;
    lastPruneMessageRef.current = null;
    return message;
  }, []);

  return useMemo(
    () => ({
      loadDraftForSuite,
      markHydrated,
      pruneAgainstValidSections,
      consumePruneMessage
    }),
    [consumePruneMessage, loadDraftForSuite, markHydrated, pruneAgainstValidSections]
  );
}
