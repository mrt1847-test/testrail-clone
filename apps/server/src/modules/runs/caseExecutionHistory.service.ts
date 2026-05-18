import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";

export type CaseExecutionHistoryRow = {
  resultId: string;
  testId: string;
  runId: string;
  runName: string;
  runClosed: boolean;
  status: string;
  comment: string | null;
  elapsed: string | null;
  version: string | null;
  defects: string[];
  createdAt: Date;
};

export async function listCaseExecutionHistory(
  prisma: PrismaClient,
  projectId: bigint,
  caseId: bigint,
  limit: number
): Promise<CaseExecutionHistoryRow[]> {
  const testCase = await prisma.testCase.findFirst({
    where: { id: caseId, projectId, deletedAt: null },
    select: { id: true }
  });
  if (!testCase) {
    throw new AppError("NOT_FOUND", "case not found", 404);
  }

  const rows = await prisma.testResult.findMany({
    where: {
      instance: {
        caseId,
        deletedAt: null,
        run: { projectId, deletedAt: null }
      }
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      comment: true,
      elapsed: true,
      version: true,
      defects: true,
      createdAt: true,
      instance: {
        select: {
          id: true,
          run: {
            select: {
              id: true,
              name: true,
              closedAt: true
            }
          }
        }
      }
    }
  });

  return rows.map((row) => ({
    resultId: row.id.toString(),
    testId: row.instance.id.toString(),
    runId: row.instance.run.id.toString(),
    runName: row.instance.run.name,
    runClosed: row.instance.run.closedAt != null,
    status: row.status,
    comment: row.comment,
    elapsed: row.elapsed,
    version: row.version,
    defects: row.defects,
    createdAt: row.createdAt
  }));
}
