import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import type { executionCommentEntityTypeSchema } from "./executionComments.schema.js";
import type { z } from "zod";

export type ExecutionCommentEntityType = z.infer<typeof executionCommentEntityTypeSchema>;

export type ExecutionCommentRow = {
  id: bigint;
  projectId: bigint;
  entityType: ExecutionCommentEntityType;
  entityId: bigint;
  parentId: bigint | null;
  content: string;
  createdAt: Date;
  author: { id: bigint; email: string; name: string } | null;
};

const authorSelect = {
  id: true,
  email: true,
  name: true
} as const;

function mapComment(row: {
  id: bigint;
  projectId: bigint;
  entityType: string;
  entityId: bigint;
  parentId: bigint | null;
  content: string;
  createdAt: Date;
  createdByUser: { id: bigint; email: string; name: string } | null;
}): ExecutionCommentRow {
  return {
    id: row.id,
    projectId: row.projectId,
    entityType: row.entityType as ExecutionCommentEntityType,
    entityId: row.entityId,
    parentId: row.parentId,
    content: row.content,
    createdAt: row.createdAt,
    author: row.createdByUser
  };
}

export async function resolveTestInstanceCommentTarget(prisma: PrismaClient, testId: bigint) {
  const instance = await prisma.testInstance.findFirst({
    where: { id: testId, deletedAt: null },
    select: {
      id: true,
      titleSnapshot: true,
      run: { select: { id: true, projectId: true, name: true, deletedAt: true } }
    }
  });
  if (!instance || instance.run.deletedAt) {
    throw new AppError("NOT_FOUND", `test ${testId.toString()} not found`, 404);
  }
  return {
    projectId: instance.run.projectId,
    entityType: "test_instance" as const,
    entityId: instance.id,
    contextTitle: instance.titleSnapshot,
    runId: instance.run.id,
    runName: instance.run.name
  };
}

export async function resolveRunCommentTarget(prisma: PrismaClient, runId: bigint) {
  const run = await prisma.testRun.findFirst({
    where: { id: runId, deletedAt: null },
    select: { id: true, projectId: true, name: true }
  });
  if (!run) {
    throw new AppError("NOT_FOUND", `run ${runId.toString()} not found`, 404);
  }
  return {
    projectId: run.projectId,
    entityType: "test_run" as const,
    entityId: run.id,
    contextTitle: run.name,
    runId: run.id,
    runName: run.name
  };
}

export async function listExecutionComments(
  prisma: PrismaClient,
  input: { entityType: ExecutionCommentEntityType; entityId: bigint }
) {
  const rows = await prisma.executionComment.findMany({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      deletedAt: null
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      projectId: true,
      entityType: true,
      entityId: true,
      parentId: true,
      content: true,
      createdAt: true,
      createdByUser: { select: authorSelect }
    }
  });
  return rows.map(mapComment);
}

export async function createExecutionComment(
  prisma: PrismaClient,
  input: {
    projectId: bigint;
    entityType: ExecutionCommentEntityType;
    entityId: bigint;
    content: string;
    parentId?: bigint;
    createdBy: bigint;
  }
) {
  if (input.parentId) {
    const parent = await prisma.executionComment.findFirst({
      where: {
        id: input.parentId,
        deletedAt: null,
        entityType: input.entityType,
        entityId: input.entityId
      },
      select: { id: true }
    });
    if (!parent) {
      throw new AppError("NOT_FOUND", "parent comment not found on this thread", 404);
    }
  }

  const created = await prisma.executionComment.create({
    data: {
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      parentId: input.parentId ?? null,
      content: input.content,
      createdBy: input.createdBy
    },
    select: {
      id: true,
      projectId: true,
      entityType: true,
      entityId: true,
      parentId: true,
      content: true,
      createdAt: true,
      createdByUser: { select: authorSelect }
    }
  });
  return mapComment(created);
}
