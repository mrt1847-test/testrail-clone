import type { PrismaClient } from "@prisma/client";

import { AppError } from "../common/errors/appError.js";
import { normalizeProjectType, projectTypeAllowsMultipleSuites } from "./projectTypes.js";

type CaseSuiteRow = { id: bigint; suiteId: bigint };

function buildMismatchMessage(multiSuiteProject: boolean) {
  if (multiSuiteProject) {
    return "A test run may only include cases from one suite. One or more cases belong to a different suite than the run.";
  }
  return "One or more cases are not in the run suite.";
}

export function assertExplicitCaseIdsBelongToRunSuite(
  requestedCaseIds: bigint[] | undefined,
  resolvedCases: CaseSuiteRow[],
  runSuiteId: bigint,
  options?: { multiSuiteProject?: boolean }
) {
  if (!requestedCaseIds?.length) return;

  const resolvedById = new Map(resolvedCases.map((row) => [row.id.toString(), row]));
  const invalidCaseIds: string[] = [];

  for (const caseId of requestedCaseIds) {
    const row = resolvedById.get(caseId.toString());
    if (!row || row.suiteId !== runSuiteId) {
      invalidCaseIds.push(caseId.toString());
    }
  }

  if (invalidCaseIds.length > 0) {
    throw new AppError("RUN_SUITE_CASE_MISMATCH", buildMismatchMessage(options?.multiSuiteProject ?? false), 409, {
      suiteId: runSuiteId.toString(),
      invalidCaseIds
    });
  }
}

export async function validateRunSuiteBinding(
  prisma: PrismaClient,
  input: { projectId: bigint; suiteId: bigint; caseIds?: bigint[] }
) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: { projectType: true }
  });
  if (!project) {
    throw new AppError("NOT_FOUND", "project not found", 404);
  }

  const suite = await prisma.testSuite.findFirst({
    where: { id: input.suiteId, projectId: input.projectId, deletedAt: null },
    select: { id: true }
  });
  if (!suite) {
    throw new AppError("VALIDATION_ERROR", "suite_id must belong to the project", 400);
  }

  const multiSuiteProject =
    projectTypeAllowsMultipleSuites(normalizeProjectType(project.projectType)) &&
    (await prisma.testSuite.count({ where: { projectId: input.projectId, deletedAt: null } })) > 1;

  if (!input.caseIds?.length) {
    return { multiSuiteProject };
  }

  const rows = await prisma.testCase.findMany({
    where: { id: { in: input.caseIds }, projectId: input.projectId, deletedAt: null },
    select: { id: true, suiteId: true }
  });

  assertExplicitCaseIdsBelongToRunSuite(input.caseIds, rows, input.suiteId, { multiSuiteProject });
  return { multiSuiteProject };
}
