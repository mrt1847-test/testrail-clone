import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  buildCaseActivitySummary,
  categorizeCaseActivityEvent,
  type CaseActivityEventInput
} from "../../domain/caseActivitySummary.js";

export const caseActivitySummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  actorUserId: z.coerce.bigint().optional(),
  category: z.enum(["created", "updated", "deleted", "other", "all"]).default("all")
});

export async function buildCaseActivitySummaryReport(
  prisma: PrismaClient | undefined,
  projectId: bigint,
  query: z.infer<typeof caseActivitySummaryQuerySchema>
) {
  if (!prisma) {
    return buildCaseActivitySummary([]);
  }

  const since = new Date();
  since.setDate(since.getDate() - query.days);

  const rows = await prisma.activityEvent.findMany({
    where: {
      projectId,
      entityType: "case",
      createdAt: { gte: since },
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {})
    },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000
  });

  const events: CaseActivityEventInput[] = rows.map((row) => ({
    id: row.id.toString(),
    eventType: row.eventType,
    entityId: row.entityId.toString(),
    title: row.title,
    body: row.body,
    actorUserId: row.actorUserId?.toString() ?? null,
    actorName: row.actorUser?.name ?? row.actorUser?.email ?? null,
    createdAt: row.createdAt
  }));

  const filtered =
    query.category === "all"
      ? events
      : events.filter((row) => categorizeCaseActivityEvent(row.eventType) === query.category);

  return buildCaseActivitySummary(filtered);
}
