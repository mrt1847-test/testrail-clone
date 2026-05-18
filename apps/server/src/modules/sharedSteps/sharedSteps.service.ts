import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";

export type SharedStepEntryInput = {
  content: string;
  expectedResult?: string | null;
};

function normalizeEntries(entries: SharedStepEntryInput[]) {
  const cleaned = entries
    .map((row, index) => ({
      stepOrder: index + 1,
      content: row.content.trim(),
      expectedResult: row.expectedResult?.trim() ? row.expectedResult.trim() : null
    }))
    .filter((row) => row.content.length > 0);
  if (cleaned.length === 0) {
    throw new AppError("VALIDATION_ERROR", "at least one step is required", 400);
  }
  return cleaned;
}

export async function listSharedStepsForProject(prisma: PrismaClient, projectId: bigint) {
  const rows = await prisma.sharedStep.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { id: "desc" },
    include: {
      entries: {
        where: { deletedAt: null },
        orderBy: { stepOrder: "asc" }
      }
    }
  });
  const usageLinks =
    rows.length === 0
      ? []
      : await prisma.testCaseStep.findMany({
          where: { sharedStepId: { in: rows.map((row) => row.id) }, deletedAt: null },
          distinct: ["sharedStepId", "caseId"],
          select: { sharedStepId: true, caseId: true }
        });
  const usageByStep = new Map<string, number>();
  for (const link of usageLinks) {
    if (!link.sharedStepId) continue;
    const key = link.sharedStepId.toString();
    usageByStep.set(key, (usageByStep.get(key) ?? 0) + 1);
  }
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      stepOrder: entry.stepOrder,
      content: entry.content,
      expectedResult: entry.expectedResult
    })),
    linkedCaseCount: usageByStep.get(row.id.toString()) ?? 0
  }));
}

export async function getSharedStepForProject(prisma: PrismaClient, projectId: bigint, sharedStepId: bigint) {
  const row = await prisma.sharedStep.findFirst({
    where: { id: sharedStepId, projectId, deletedAt: null },
    include: {
      entries: {
        where: { deletedAt: null },
        orderBy: { stepOrder: "asc" }
      }
    }
  });
  if (!row) return null;
  const linkedCaseIds = await prisma.testCaseStep.findMany({
    where: { sharedStepId: row.id, deletedAt: null },
    distinct: ["caseId"],
    select: { caseId: true }
  });
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      stepOrder: entry.stepOrder,
      content: entry.content,
      expectedResult: entry.expectedResult
    })),
    caseIds: linkedCaseIds.map((link) => link.caseId)
  };
}

export async function createSharedStep(
  prisma: PrismaClient,
  input: { projectId: bigint; title: string; entries: SharedStepEntryInput[]; userId?: bigint }
) {
  const entries = normalizeEntries(input.entries);
  return prisma.$transaction(async (tx) => {
    const created = await tx.sharedStep.create({
      data: {
        projectId: input.projectId,
        title: input.title.trim(),
        createdBy: input.userId,
        updatedBy: input.userId,
        entries: {
          create: entries.map((entry) => ({
            stepOrder: entry.stepOrder,
            content: entry.content,
            expectedResult: entry.expectedResult
          }))
        }
      },
      include: {
        entries: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } }
      }
    });
    return created;
  });
}

export async function updateSharedStep(
  prisma: PrismaClient,
  input: {
    projectId: bigint;
    sharedStepId: bigint;
    title?: string;
    entries?: SharedStepEntryInput[];
    userId?: bigint;
  }
) {
  const existing = await prisma.sharedStep.findFirst({
    where: { id: input.sharedStepId, projectId: input.projectId, deletedAt: null },
    include: { entries: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    if (input.title !== undefined) {
      await tx.sharedStep.update({
        where: { id: existing.id },
        data: { title: input.title.trim(), updatedBy: input.userId }
      });
    }

    if (input.entries !== undefined) {
      const entries = normalizeEntries(input.entries);
      const keptEntryIds: bigint[] = [];
      const sortedExisting = [...existing.entries].sort((a, b) => a.stepOrder - b.stepOrder);

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]!;
        const prior = sortedExisting[index];
        if (prior) {
          await tx.sharedStepEntry.update({
            where: { id: prior.id },
            data: {
              stepOrder: entry.stepOrder,
              content: entry.content,
              expectedResult: entry.expectedResult
            }
          });
          await tx.testCaseStep.updateMany({
            where: { sharedStepEntryId: prior.id, deletedAt: null },
            data: {
              content: entry.content,
              expectedResult: entry.expectedResult
            }
          });
          keptEntryIds.push(prior.id);
        } else {
          const created = await tx.sharedStepEntry.create({
            data: {
              sharedStepId: existing.id,
              stepOrder: entry.stepOrder,
              content: entry.content,
              expectedResult: entry.expectedResult
            }
          });
          keptEntryIds.push(created.id);
        }
      }

      const removedIds = sortedExisting.slice(entries.length).map((row) => row.id);
      if (removedIds.length > 0) {
        await tx.sharedStepEntry.updateMany({
          where: { id: { in: removedIds } },
          data: { deletedAt: new Date() }
        });
        await tx.testCaseStep.updateMany({
          where: { sharedStepEntryId: { in: removedIds }, deletedAt: null },
          data: { deletedAt: new Date() }
        });
      }
    }

    return tx.sharedStep.findFirst({
      where: { id: existing.id },
      include: { entries: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
    });
  });
}

export async function deleteSharedStep(prisma: PrismaClient, projectId: bigint, sharedStepId: bigint) {
  const existing = await prisma.sharedStep.findFirst({
    where: { id: sharedStepId, projectId, deletedAt: null }
  });
  if (!existing) return false;
  await prisma.sharedStep.update({
    where: { id: sharedStepId },
    data: { deletedAt: new Date() }
  });
  return true;
}

export async function attachSharedStepToCase(
  prisma: PrismaClient,
  input: { caseId: bigint; sharedStepId: bigint }
) {
  const testCase = await prisma.testCase.findFirst({
    where: { id: input.caseId, deletedAt: null },
    select: { id: true, projectId: true }
  });
  if (!testCase) throw new AppError("NOT_FOUND", `case ${input.caseId.toString()} not found`, 404);

  const sharedStep = await prisma.sharedStep.findFirst({
    where: { id: input.sharedStepId, projectId: testCase.projectId, deletedAt: null },
    include: { entries: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
  });
  if (!sharedStep) {
    throw new AppError("NOT_FOUND", `shared step ${input.sharedStepId.toString()} not found`, 404);
  }
  if (sharedStep.entries.length === 0) {
    throw new AppError("VALIDATION_ERROR", "shared step has no steps", 400);
  }

  const existingSteps = await prisma.testCaseStep.findMany({
    where: { caseId: input.caseId, deletedAt: null },
    orderBy: { stepOrder: "asc" },
    select: { stepOrder: true }
  });
  let nextOrder = existingSteps.reduce((max, row) => Math.max(max, row.stepOrder), 0);

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const entry of sharedStep.entries) {
      nextOrder += 1;
      rows.push(
        await tx.testCaseStep.create({
          data: {
            caseId: input.caseId,
            stepOrder: nextOrder,
            content: entry.content,
            expectedResult: entry.expectedResult,
            sharedStepId: sharedStep.id,
            sharedStepEntryId: entry.id
          },
          select: {
            id: true,
            stepOrder: true,
            content: true,
            expectedResult: true,
            sharedStepId: true,
            sharedStepEntryId: true
          }
        })
      );
    }
    return rows;
  });

  return created;
}

export async function listSharedStepsForV2(prisma: PrismaClient, projectId: bigint) {
  const rows = await listSharedStepsForProject(prisma, projectId);
  const caseLinks = await prisma.testCaseStep.findMany({
    where: { sharedStepId: { in: rows.map((row) => row.id) }, deletedAt: null },
    distinct: ["sharedStepId", "caseId"],
    select: { sharedStepId: true, caseId: true }
  });
  const caseIdsBySharedStep = new Map<string, number[]>();
  for (const link of caseLinks) {
    if (!link.sharedStepId) continue;
    const key = link.sharedStepId.toString();
    const bucket = caseIdsBySharedStep.get(key) ?? [];
    bucket.push(Number(link.caseId));
    caseIdsBySharedStep.set(key, bucket);
  }
  return rows.map((row) => ({
    row,
    caseIds: caseIdsBySharedStep.get(row.id.toString()) ?? []
  }));
}
