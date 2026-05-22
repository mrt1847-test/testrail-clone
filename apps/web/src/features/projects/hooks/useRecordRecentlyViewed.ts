import { useEffect } from "react";

import { useAuth } from "../../auth/context/AuthContext";
import { recordRecentlyViewed, type RecentlyViewedEntry } from "../utils/recentlyViewed";

type RecordInput = Omit<RecentlyViewedEntry, "viewedAt"> | null;

export function useRecordRecentlyViewed(projectId: string, entry: RecordInput) {
  const { user } = useAuth();

  useEffect(() => {
    if (!projectId || !entry) return;
    recordRecentlyViewed(projectId, user?.id, entry);
  }, [entry?.id, entry?.kind, entry?.subtitle, entry?.title, projectId, user?.id]);
}
