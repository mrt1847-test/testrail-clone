import type { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function expandSectionSubtreeIdsPure(
  sections: Array<{ id: bigint; parentSectionId: bigint | null | undefined }>,
  rootSectionIds: bigint[]
): bigint[] {
  if (rootSectionIds.length === 0) return [];
  const children = new Map<bigint | null, bigint[]>();
  for (const row of sections) {
    const parent = row.parentSectionId ?? null;
    const list = children.get(parent);
    if (list) list.push(row.id);
    else children.set(parent, [row.id]);
  }
  const out = new Set<bigint>();
  const stack = [...rootSectionIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const kids = children.get(id);
    if (kids) for (const k of kids) stack.push(k);
  }
  return [...out];
}

export async function expandSectionSubtreeIds(db: Db, suiteId: bigint, rootSectionIds: bigint[]): Promise<bigint[]> {
  if (rootSectionIds.length === 0) return [];
  const sections = await db.section.findMany({
    where: { suiteId, deletedAt: null },
    select: { id: true, parentSectionId: true }
  });
  return expandSectionSubtreeIdsPure(
    sections.map((s) => ({ id: s.id, parentSectionId: s.parentSectionId })),
    rootSectionIds
  );
}

export async function assertSectionsBelongToSuite(db: Db, suiteId: bigint, sectionIds: bigint[]) {
  if (sectionIds.length === 0) return;
  const count = await db.section.count({
    where: { id: { in: sectionIds }, suiteId, deletedAt: null }
  });
  if (count !== sectionIds.length) {
    throw new AppError("VALIDATION_ERROR", "includedSectionIds or excludedSectionIds must belong to the run suite", 400);
  }
}
