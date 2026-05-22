import { buildAbsoluteShareUrl, buildEntitySharePath } from "./entityShare";
import type { EntityJumpKind } from "./entityJump";

export type EntityContextTarget = {
  projectId: string;
  kind: EntityJumpKind;
  entityId: string | number;
  sectionId?: number | null;
  listSearchParams?: URLSearchParams;
};

export function getEntityShareUrl(target: EntityContextTarget): string {
  const path = buildEntitySharePath(target.projectId, target.kind, target.entityId, {
    sectionId: target.sectionId,
    listSearchParams: target.listSearchParams
  });
  return buildAbsoluteShareUrl(path);
}

export function openEntityInNewTab(target: EntityContextTarget): void {
  const url = getEntityShareUrl(target);
  window.open(url, "_blank", "noopener,noreferrer");
}
