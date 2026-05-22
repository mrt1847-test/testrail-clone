import { suiteStorageKey } from "../workspacePreferences";

export type UserPinsState = {
  projectIds: string[];
  defaultSuiteByProject: Record<string, string>;
};

const EMPTY: UserPinsState = { projectIds: [], defaultSuiteByProject: {} };

export function userPinsStorageKey(userId?: string | null): string {
  return userId ? `user-pins:${userId}` : "user-pins:anon";
}

function readState(userId?: string | null): UserPinsState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(userPinsStorageKey(userId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<UserPinsState>;
    return {
      projectIds: Array.isArray(parsed.projectIds)
        ? parsed.projectIds.filter((id): id is string => typeof id === "string")
        : [],
      defaultSuiteByProject:
        parsed.defaultSuiteByProject && typeof parsed.defaultSuiteByProject === "object"
          ? Object.fromEntries(
              Object.entries(parsed.defaultSuiteByProject).filter(
                ([, suiteId]) => typeof suiteId === "string" && suiteId.length > 0
              )
            )
          : {}
    };
  } catch {
    return { ...EMPTY };
  }
}

function writeState(userId: string | null | undefined, state: UserPinsState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(userPinsStorageKey(userId), JSON.stringify(state));
}

export function getUserPins(userId?: string | null): UserPinsState {
  return readState(userId);
}

export function isProjectPinned(userId: string | null | undefined, projectId: string): boolean {
  return readState(userId).projectIds.includes(projectId);
}

export function togglePinnedProject(userId: string | null | undefined, projectId: string): UserPinsState {
  const state = readState(userId);
  const exists = state.projectIds.includes(projectId);
  const projectIds = exists
    ? state.projectIds.filter((id) => id !== projectId)
    : [projectId, ...state.projectIds];
  const next = { ...state, projectIds };
  writeState(userId, next);
  return next;
}

export function getPinnedDefaultSuiteId(
  userId: string | null | undefined,
  projectId: string
): string | null {
  return readState(userId).defaultSuiteByProject[projectId] ?? null;
}

export function setPinnedDefaultSuite(
  userId: string | null | undefined,
  projectId: string,
  suiteId: string | null
): UserPinsState {
  const state = readState(userId);
  const defaultSuiteByProject = { ...state.defaultSuiteByProject };
  if (suiteId) {
    defaultSuiteByProject[projectId] = suiteId;
    window.localStorage.setItem(suiteStorageKey(projectId, userId), suiteId);
  } else {
    delete defaultSuiteByProject[projectId];
  }
  const next = { ...state, defaultSuiteByProject };
  writeState(userId, next);
  return next;
}

export function partitionPinnedProjects<T extends { id: string; name: string }>(
  projects: T[],
  pinnedIds: string[]
): { pinned: T[]; others: T[] } {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const pinned = pinnedIds.map((id) => byId.get(id)).filter((row): row is T => row != null);
  const pinnedSet = new Set(pinnedIds);
  const others = projects
    .filter((project) => !pinnedSet.has(project.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { pinned, others };
}
