import { buildCaseDetailPath, buildCaseRepositoryPath } from "../../cases/caseRoute";
import type { EntityJumpKind } from "./entityJump";
import { entityJumpLabel } from "./entityJump";
import { captureListStateForEntityShare, mergeSearchParams } from "./listViewDeepLink";

export function formatEntityDisplayId(
  kind: EntityJumpKind,
  entityId: string | number,
  options?: { caseCode?: string | null }
): string {
  const code = options?.caseCode?.trim();
  if (kind === "case" && code) return code;
  return entityJumpLabel({ kind, id: String(entityId) });
}

export function buildEntitySharePath(
  projectId: string,
  kind: EntityJumpKind,
  entityId: string | number,
  options?: {
    sectionId?: number | null;
    listSearchParams?: URLSearchParams;
    pathname?: string;
    search?: string;
  }
): string {
  const id = String(entityId);
  if (kind === "case") {
    const numericId = Number(id);
    const pathname = options?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    const search = options?.search ?? (typeof window !== "undefined" ? window.location.search : "");
    const listParams =
      options?.listSearchParams ??
      captureListStateForEntityShare("case", pathname, search);
    listParams.set("panelCaseId", String(numericId));
    if (options?.sectionId != null) listParams.set("sectionId", String(options.sectionId));
    if (listParams.size > 0) {
      return buildCaseRepositoryPath(projectId, listParams);
    }
    return buildCaseDetailPath(projectId, numericId, { sectionId: options?.sectionId ?? null });
  }
  if (kind === "run") {
    const pathname = options?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    const search = options?.search ?? (typeof window !== "undefined" ? window.location.search : "");
    const listParams =
      options?.listSearchParams ?? captureListStateForEntityShare("run", pathname, search);
    return mergeSearchParams(`/projects/${projectId}/runs/${id}`, listParams);
  }
  if (kind === "milestone") return `/projects/${projectId}/milestones/${id}`;
  return `/projects/${projectId}/plans/${id}`;
}

export function buildRunListPath(projectId: string, listParams?: URLSearchParams): string {
  const base = `/projects/${projectId}/runs`;
  return listParams && listParams.size > 0 ? mergeSearchParams(base, listParams) : base;
}

export function buildAbsoluteShareUrl(relativePath: string): string {
  if (typeof window === "undefined") return relativePath;
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${window.location.origin}${path}`;
}
