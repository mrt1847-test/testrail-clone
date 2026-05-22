export type GlobalSearchEntityType = "case" | "run" | "milestone" | "plan" | "defect";

export type ParsedGlobalSearchQuery = {
  raw: string;
  text: string;
  caseId: bigint | null;
  runId: bigint | null;
  milestoneId: bigint | null;
  planId: bigint | null;
};

export type ProjectSearchScope = bigint | { in: bigint[] };

function projectIdFilter(scope: ProjectSearchScope) {
  return typeof scope === "bigint" ? { projectId: scope } : { projectId: { in: scope.in } };
}

const ENTITY_PREFIX_RE = /^(C|R|M|P)(\d+)$/i;

export function parseGlobalSearchQuery(raw: string): ParsedGlobalSearchQuery | null {
  const trimmed = raw.trim();
  if (trimmed.length < 1) return null;

  const parsed: ParsedGlobalSearchQuery = {
    raw: trimmed,
    text: trimmed,
    caseId: null,
    runId: null,
    milestoneId: null,
    planId: null
  };

  const compact = trimmed.replace(/\s+/g, "");
  const prefixMatch = compact.match(ENTITY_PREFIX_RE);
  if (prefixMatch) {
    const id = BigInt(prefixMatch[2]);
    const letter = prefixMatch[1].toUpperCase();
    if (letter === "C") parsed.caseId = id;
    if (letter === "R") parsed.runId = id;
    if (letter === "M") parsed.milestoneId = id;
    if (letter === "P") parsed.planId = id;
    parsed.text = "";
    return parsed;
  }

  const hashMatch = trimmed.match(/^#(\d+)$/);
  if (hashMatch) {
    const id = BigInt(hashMatch[1]);
    parsed.caseId = id;
    parsed.text = "";
    return parsed;
  }

  const numericOnly = /^\d+$/.test(compact);
  if (numericOnly) {
    const id = BigInt(compact);
    parsed.caseId = id;
    parsed.runId = id;
    parsed.milestoneId = id;
    parsed.planId = id;
    parsed.text = "";
    return parsed;
  }

  return parsed;
}

export function caseSearchWhere(scope: ProjectSearchScope, parsed: ParsedGlobalSearchQuery) {
  if (parsed.caseId != null) {
    return { ...projectIdFilter(scope), deletedAt: null, id: parsed.caseId };
  }
  const needle = parsed.text;
  return {
    ...projectIdFilter(scope),
    deletedAt: null,
    OR: [
      { title: { contains: needle, mode: "insensitive" as const } },
      { refs: { contains: needle, mode: "insensitive" as const } },
      { automationKey: { contains: needle, mode: "insensitive" as const } },
      { externalId: { contains: needle, mode: "insensitive" as const } }
    ]
  };
}

export function runSearchWhere(scope: ProjectSearchScope, parsed: ParsedGlobalSearchQuery) {
  if (parsed.runId != null) {
    return { ...projectIdFilter(scope), deletedAt: null, id: parsed.runId };
  }
  return {
    ...projectIdFilter(scope),
    deletedAt: null,
    OR: [
      { name: { contains: parsed.text, mode: "insensitive" as const } },
      { description: { contains: parsed.text, mode: "insensitive" as const } }
    ]
  };
}

export function milestoneSearchWhere(scope: ProjectSearchScope, parsed: ParsedGlobalSearchQuery) {
  if (parsed.milestoneId != null) {
    return { ...projectIdFilter(scope), deletedAt: null, id: parsed.milestoneId };
  }
  return {
    ...projectIdFilter(scope),
    deletedAt: null,
    OR: [
      { name: { contains: parsed.text, mode: "insensitive" as const } },
      { description: { contains: parsed.text, mode: "insensitive" as const } }
    ]
  };
}

export function planSearchWhere(scope: ProjectSearchScope, parsed: ParsedGlobalSearchQuery) {
  if (parsed.planId != null) {
    return { ...projectIdFilter(scope), deletedAt: null, id: parsed.planId };
  }
  return {
    ...projectIdFilter(scope),
    deletedAt: null,
    OR: [
      { name: { contains: parsed.text, mode: "insensitive" as const } },
      { description: { contains: parsed.text, mode: "insensitive" as const } },
      { refs: { contains: parsed.text, mode: "insensitive" as const } }
    ]
  };
}
