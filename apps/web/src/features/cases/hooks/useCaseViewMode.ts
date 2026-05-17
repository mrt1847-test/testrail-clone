import { useCallback, useEffect, useState } from "react";

import { type CaseViewMode, readCaseViewMode, writeCaseViewMode } from "../caseViewMode";

export function useCaseViewMode() {
  const [viewMode, setViewModeState] = useState<CaseViewMode>(readCaseViewMode);

  useEffect(() => {
    writeCaseViewMode(viewMode);
  }, [viewMode]);

  const setViewMode = useCallback((mode: CaseViewMode) => {
    setViewModeState(mode);
  }, []);

  return { viewMode, setViewMode };
}
