import { buildCaseListPath } from "../../cases/caseRoute";

export type EntityJumpKind = "case" | "run" | "milestone" | "plan";

export type EntityJumpTarget = {
  kind: EntityJumpKind;
  id: string;
};

const ENTITY_PREFIX_RE = /^(C|R|M|P)(\d+)$/i;

export function parseEntityJumpToken(raw: string): EntityJumpTarget | null {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) return null;

  const prefixMatch = compact.match(ENTITY_PREFIX_RE);
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase();
    const id = prefixMatch[2];
    if (letter === "C") return { kind: "case", id };
    if (letter === "R") return { kind: "run", id };
    if (letter === "M") return { kind: "milestone", id };
    if (letter === "P") return { kind: "plan", id };
  }

  const hashMatch = compact.match(/^#(\d+)$/);
  if (hashMatch) return { kind: "case", id: hashMatch[1] };

  return null;
}

export function isEntityJumpQuery(raw: string): boolean {
  return parseEntityJumpToken(raw) != null;
}

export function buildEntityJumpPath(projectId: string, target: EntityJumpTarget): string {
  if (target.kind === "case") {
    const caseId = Number(target.id);
    if (Number.isInteger(caseId)) {
      return buildCaseListPath(projectId, { panelCaseId: caseId });
    }
    return `/projects/${projectId}/cases/${target.id}`;
  }
  if (target.kind === "run") return `/projects/${projectId}/runs/${target.id}`;
  if (target.kind === "milestone") return `/projects/${projectId}/milestones/${target.id}`;
  return `/projects/${projectId}/plans/${target.id}`;
}

export function entityJumpLabel(target: EntityJumpTarget): string {
  const prefix = { case: "C", run: "R", milestone: "M", plan: "P" }[target.kind];
  return `${prefix}${target.id}`;
}
