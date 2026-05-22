export type CaseRepositoryTreeSide = "left" | "right";

const storageKey = (projectId: string) => `cases:tree-side:${projectId}`;

export function readCaseRepositoryTreeSide(projectId: string): CaseRepositoryTreeSide {
  if (typeof window === "undefined") return "left";
  const raw = window.localStorage.getItem(storageKey(projectId));
  return raw === "right" ? "right" : "left";
}

export function writeCaseRepositoryTreeSide(projectId: string, side: CaseRepositoryTreeSide) {
  window.localStorage.setItem(storageKey(projectId), side);
}
