import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../auth/context/AuthContext";
import {
  getUserPins,
  setPinnedDefaultSuite,
  togglePinnedProject,
  type UserPinsState
} from "../utils/pinnedProjects";

export function usePinnedProjects() {
  const { user } = useAuth();
  const userId = user?.id;
  const [pins, setPins] = useState<UserPinsState>(() => getUserPins(userId));

  useEffect(() => {
    setPins(getUserPins(userId));
  }, [userId]);

  const refresh = useCallback(() => setPins(getUserPins(userId)), [userId]);

  const toggleProjectPin = useCallback(
    (projectId: string) => {
      setPins(togglePinnedProject(userId, projectId));
    },
    [userId]
  );

  const pinDefaultSuite = useCallback(
    (projectId: string, suiteId: string | null) => {
      setPins(setPinnedDefaultSuite(userId, projectId, suiteId));
    },
    [userId]
  );

  return {
    pinnedProjectIds: pins.projectIds,
    defaultSuiteByProject: pins.defaultSuiteByProject,
    toggleProjectPin,
    pinDefaultSuite,
    refresh,
    isProjectPinned: (projectId: string) => pins.projectIds.includes(projectId),
    pinnedSuiteFor: (projectId: string) => pins.defaultSuiteByProject[projectId] ?? null
  };
}
