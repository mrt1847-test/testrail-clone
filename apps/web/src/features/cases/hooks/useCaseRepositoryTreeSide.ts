import { useCallback, useState } from "react";

import {
  readCaseRepositoryTreeSide,
  writeCaseRepositoryTreeSide,
  type CaseRepositoryTreeSide
} from "../caseRepositoryLayout";

export function useCaseRepositoryTreeSide(projectId: string) {
  const [treeSide, setTreeSideState] = useState<CaseRepositoryTreeSide>(() =>
    readCaseRepositoryTreeSide(projectId)
  );

  const setTreeSide = useCallback(
    (side: CaseRepositoryTreeSide) => {
      setTreeSideState(side);
      writeCaseRepositoryTreeSide(projectId, side);
    },
    [projectId]
  );

  const toggleTreeSide = useCallback(() => {
    setTreeSide(treeSide === "right" ? "left" : "right");
  }, [setTreeSide, treeSide]);

  return { treeSide, setTreeSide, toggleTreeSide };
}
