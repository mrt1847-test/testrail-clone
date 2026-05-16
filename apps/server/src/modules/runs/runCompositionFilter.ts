import type { Prisma, PrismaClient } from "@prisma/client";

import type { RunCaseFilterDefinition } from "./runComposition.js";
import { expandSectionSubtreeIds } from "./sectionScope.js";

export type RunCompositionScope = {
  projectId: bigint;
  suiteId: bigint;
  includeAll: boolean;
  excludedCaseIds?: bigint[];
  includedSectionIds?: bigint[];
  excludedSectionIds?: bigint[];
  filterDefinition?: RunCaseFilterDefinition;
};

export async function resolveDesiredCaseIds(
  prisma: PrismaClient | Prisma.TransactionClient,
  scope: RunCompositionScope
): Promise<bigint[]> {
  let allowedSectionIds: bigint[] | undefined;
  if (scope.includedSectionIds?.length) {
    allowedSectionIds = await expandSectionSubtreeIds(prisma, scope.suiteId, scope.includedSectionIds);
  }
  let excludedSectionIds: bigint[] | undefined;
  if (scope.excludedSectionIds?.length) {
    excludedSectionIds = await expandSectionSubtreeIds(prisma, scope.suiteId, scope.excludedSectionIds);
  }

  const filter = scope.filterDefinition;
  const archivedFilter =
    filter?.state === "archived"
      ? { archivedAt: { not: null } }
      : filter?.state === "active"
        ? { archivedAt: null }
        : { archivedAt: null };

  const where: Prisma.TestCaseWhereInput = {
    projectId: scope.projectId,
    suiteId: scope.suiteId,
    deletedAt: null,
    ...archivedFilter,
    ...(scope.excludedCaseIds?.length ? { id: { notIn: scope.excludedCaseIds } } : {}),
    ...(allowedSectionIds?.length ? { sectionId: { in: allowedSectionIds } } : {}),
    ...(excludedSectionIds?.length ? { sectionId: { notIn: excludedSectionIds } } : {}),
    ...(filter?.priority ? { priority: filter.priority } : {})
  };

  const rows = await prisma.testCase.findMany({
    where,
    select: { id: true },
    orderBy: { id: "asc" }
  });
  return rows.map((row) => row.id);
}
