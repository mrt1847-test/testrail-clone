import type { GlobalSearchEntityType } from "../api/projectSearchApi";

export const ENTITY_LABELS: Record<GlobalSearchEntityType, string> = {
  case: "Case",
  run: "Run",
  milestone: "Milestone",
  plan: "Plan",
  defect: "Defect"
};

const ENTITY_ORDER: GlobalSearchEntityType[] = ["case", "run", "milestone", "plan", "defect"];

export type GlobalSearchHitBase = {
  entityType: GlobalSearchEntityType;
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
};

export function groupHitsByEntityType<T extends GlobalSearchHitBase>(items: T[]) {
  const groups = new Map<GlobalSearchEntityType, T[]>();
  for (const item of items) {
    const bucket = groups.get(item.entityType) ?? [];
    bucket.push(item);
    groups.set(item.entityType, bucket);
  }
  return ENTITY_ORDER.filter((type) => (groups.get(type)?.length ?? 0) > 0).map((type) => ({
    type,
    items: groups.get(type) ?? []
  }));
}

export type CrossProjectSearchHit = GlobalSearchHitBase & {
  projectId: string;
  projectName: string;
};

export type CrossProjectSearchProjectGroup = {
  projectId: string;
  projectName: string;
  entityGroups: ReturnType<typeof groupHitsByEntityType<CrossProjectSearchHit>>;
};

export function groupHitsByProject(items: CrossProjectSearchHit[]): CrossProjectSearchProjectGroup[] {
  const byProject = new Map<string, CrossProjectSearchHit[]>();
  for (const item of items) {
    const bucket = byProject.get(item.projectId) ?? [];
    bucket.push(item);
    byProject.set(item.projectId, bucket);
  }
  return [...byProject.entries()]
    .map(([projectId, projectItems]) => ({
      projectId,
      projectName: projectItems[0]?.projectName ?? "Project",
      entityGroups: groupHitsByEntityType(projectItems)
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName));
}
