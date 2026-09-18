import { useCallback, useState } from "react";

import {
  readUiDensity,
  surfaceDefaultUiDensity,
  writeUiDensity,
  type UiDensity,
  type UiDensitySurface
} from "../ui/density/uiDensity";

export function useUiDensity(projectId: string, surface: UiDensitySurface, userId?: string | null) {
  const [density, setDensityState] = useState<UiDensity>(() =>
    projectId ? readUiDensity(projectId, surface, userId) : surfaceDefaultUiDensity(surface)
  );

  const setDensity = useCallback(
    (next: UiDensity) => {
      setDensityState(next);
      if (projectId) writeUiDensity(projectId, surface, next, userId);
    },
    [projectId, surface, userId]
  );

  return [density, setDensity] as const;
}
