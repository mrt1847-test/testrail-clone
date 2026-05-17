export type CaseActivityCategory = "created" | "updated" | "deleted" | "other";

export type CaseActivityEventInput = {
  id: string;
  eventType: string;
  entityId: string;
  title: string;
  body: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: Date | string;
};

export type CaseActivitySummary = {
  totalEvents: number;
  uniqueCaseCount: number;
  byDay: Array<{
    date: string;
    created: number;
    updated: number;
    deleted: number;
    other: number;
    total: number;
  }>;
  byCategory: Array<{ category: CaseActivityCategory; count: number }>;
  byActor: Array<{ actorUserId: string | null; actorName: string; count: number }>;
  recent: Array<{
    id: string;
    eventType: string;
    category: CaseActivityCategory;
    caseId: string;
    title: string;
    body: string | null;
    actorUserId: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
};

export function categorizeCaseActivityEvent(eventType: string): CaseActivityCategory {
  if (eventType === "case.created" || eventType.startsWith("case.created")) return "created";
  if (eventType === "case.deleted" || eventType.includes("deleted") || eventType.includes("archived")) {
    return "deleted";
  }
  if (eventType.startsWith("case.")) return "updated";
  return "other";
}

function toDayKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

export function buildCaseActivitySummary(
  events: CaseActivityEventInput[],
  options?: { recentLimit?: number }
): CaseActivitySummary {
  const recentLimit = options?.recentLimit ?? 50;
  const byDay = new Map<
    string,
    { created: number; updated: number; deleted: number; other: number; total: number }
  >();
  const byCategory = new Map<CaseActivityCategory, number>();
  const byActor = new Map<string, { actorUserId: string | null; actorName: string; count: number }>();
  const uniqueCases = new Set<string>();

  for (const event of events) {
    const category = categorizeCaseActivityEvent(event.eventType);
    uniqueCases.add(event.entityId);
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);

    const dayKey = toDayKey(event.createdAt);
    const day = byDay.get(dayKey) ?? { created: 0, updated: 0, deleted: 0, other: 0, total: 0 };
    day.total += 1;
    day[category] += 1;
    byDay.set(dayKey, day);

    const actorKey = event.actorUserId ?? "unknown";
    const actor = byActor.get(actorKey) ?? {
      actorUserId: event.actorUserId,
      actorName: event.actorName?.trim() || "System",
      count: 0
    };
    actor.count += 1;
    byActor.set(actorKey, actor);
  }

  const sortedRecent = [...events]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, recentLimit)
    .map((event) => ({
      id: event.id,
      eventType: event.eventType,
      category: categorizeCaseActivityEvent(event.eventType),
      caseId: event.entityId,
      title: event.title,
      body: event.body,
      actorUserId: event.actorUserId,
      actorName: event.actorName?.trim() || "System",
      createdAt: new Date(event.createdAt).toISOString()
    }));

  return {
    totalEvents: events.length,
    uniqueCaseCount: uniqueCases.size,
    byDay: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({ date, ...row })),
    byCategory: (["created", "updated", "deleted", "other"] as const).map((category) => ({
      category,
      count: byCategory.get(category) ?? 0
    })),
    byActor: [...byActor.values()].sort((a, b) => b.count - a.count || a.actorName.localeCompare(b.actorName)),
    recent: sortedRecent
  };
}
