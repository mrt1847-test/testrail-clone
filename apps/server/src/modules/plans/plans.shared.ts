import type { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import {
  assertPlanEntryIncluded,
  mergePlanScheduling,
  normalizePlanRefs,
  parseStoredCaseIds,
  resolvePlanEntryRunComposition,
  serializeCaseIds
} from "../../domain/planEntrySemantics.js";
import type { RunsService } from "../runs/runs.service.js";
import type { CreateRunWithInstancesInput } from "../runs/runs.types.js";

export type MemoryPlanEntry = {
  id: bigint;
  name: string;
  environment?: string;
  suiteId?: bigint;
  runId?: bigint;
  assignedTo?: bigint | null;
  refs?: string | null;
  startDate?: Date | null;
  dueOn?: Date | null;
  includeAll?: boolean;
  includeCaseIds?: bigint[];
  excludeCaseIds?: bigint[];
  isIncluded?: boolean;
  configurationIds?: bigint[];
};

export type MemoryPlanRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  assignedTo?: bigint | null;
  refs?: string | null;
  startDate?: Date | null;
  dueOn?: Date | null;
  entries: MemoryPlanEntry[];
};

type PlanLike = {
  id: bigint;
  projectId: bigint;
  name: string;
  milestoneId?: bigint | null;
  assignedTo?: bigint | null;
  refs?: string | null;
  startDate?: Date | null;
  dueOn?: Date | null;
};

type EntryLike = {
  id: bigint;
  name: string;
  environment?: string | null;
  suiteId?: bigint | null;
  runId?: bigint | null;
  assignedTo?: bigint | null;
  refs?: string | null;
  startDate?: Date | null;
  dueOn?: Date | null;
  includeAll?: boolean;
  includeCaseIds?: unknown;
  excludeCaseIds?: unknown;
  isIncluded?: boolean;
};

export function toPlanDto(row: PlanLike) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    assignedTo: row.assignedTo?.toString() ?? null,
    refs: row.refs ?? null,
    startDate: row.startDate?.toISOString() ?? null,
    dueOn: row.dueOn?.toISOString() ?? null,
    entries: [] as []
  };
}

export function toPlanEntryDto(row: EntryLike) {
  return {
    id: row.id,
    name: row.name,
    environment: row.environment ?? undefined,
    suiteId: row.suiteId?.toString() ?? null,
    runId: row.runId?.toString() ?? undefined,
    assignedTo: row.assignedTo?.toString() ?? null,
    refs: row.refs ?? null,
    startDate: row.startDate?.toISOString() ?? null,
    dueOn: row.dueOn?.toISOString() ?? null,
    includeAll: row.includeAll ?? true,
    includeCaseIds: parseStoredCaseIds(row.includeCaseIds).map((id) => id.toString()),
    excludeCaseIds: parseStoredCaseIds(row.excludeCaseIds).map((id) => id.toString()),
    isIncluded: row.isIncluded ?? true
  };
}

export function buildPlanCreateData(
  projectId: bigint,
  body: {
    name?: string;
    assignedTo?: bigint | null;
    refs?: string | null;
    startDate?: Date | null;
    dueOn?: Date | null;
  }
): Prisma.TestPlanCreateInput {
  return {
    projectId,
    name: body.name?.trim() || "New test plan",
    assignedTo: body.assignedTo ?? undefined,
    refs: body.refs === undefined ? undefined : normalizePlanRefs(body.refs),
    startDate: body.startDate ?? undefined,
    dueOn: body.dueOn ?? undefined
  };
}

export function buildPlanWriteData(body: {
  name?: string;
  assignedTo?: bigint | null;
  refs?: string | null;
  startDate?: Date | null;
  dueOn?: Date | null;
}) {
  const data: Prisma.TestPlanUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim() || "Untitled plan";
  if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo;
  if (body.refs !== undefined) data.refs = normalizePlanRefs(body.refs);
  if (body.startDate !== undefined) data.startDate = body.startDate;
  if (body.dueOn !== undefined) data.dueOn = body.dueOn;
  return data;
}

export function buildPlanEntryWriteData(body: {
  name?: string;
  environment?: string | null;
  suiteId?: bigint | null;
  assignedTo?: bigint | null;
  refs?: string | null;
  startDate?: Date | null;
  dueOn?: Date | null;
  includeAll?: boolean;
  includeCaseIds?: bigint[];
  excludeCaseIds?: bigint[];
  isIncluded?: boolean;
}) {
  const data: Prisma.TestPlanEntryUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim() || "Untitled entry";
  if (body.environment !== undefined) {
    data.environment = body.environment === null ? null : body.environment.trim() || null;
  }
  if (body.suiteId !== undefined) data.suiteId = body.suiteId;
  if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo;
  if (body.refs !== undefined) data.refs = normalizePlanRefs(body.refs);
  if (body.startDate !== undefined) data.startDate = body.startDate;
  if (body.dueOn !== undefined) data.dueOn = body.dueOn;
  if (body.includeAll !== undefined) data.includeAll = body.includeAll;
  if (body.includeCaseIds !== undefined) data.includeCaseIds = serializeCaseIds(body.includeCaseIds);
  if (body.excludeCaseIds !== undefined) data.excludeCaseIds = serializeCaseIds(body.excludeCaseIds);
  if (body.isIncluded !== undefined) data.isIncluded = body.isIncluded;
  return data;
}

export function buildPlanEntryCreateData(
  planId: bigint,
  body: {
    name?: string;
    environment?: string | null;
    suiteId?: bigint | null;
    assignedTo?: bigint | null;
    refs?: string | null;
    startDate?: Date | null;
    dueOn?: Date | null;
    includeAll?: boolean;
    includeCaseIds?: bigint[];
    excludeCaseIds?: bigint[];
    isIncluded?: boolean;
  }
): Prisma.TestPlanEntryCreateInput {
  return {
    plan: { connect: { id: planId } },
    name: body.name?.trim() || "Entry",
    environment: body.environment === undefined ? undefined : body.environment?.trim() || null,
    suiteId: body.suiteId ?? undefined,
    assignedTo: body.assignedTo ?? undefined,
    refs: body.refs === undefined ? undefined : normalizePlanRefs(body.refs),
    startDate: body.startDate ?? undefined,
    dueOn: body.dueOn ?? undefined,
    includeAll: body.includeAll ?? true,
    includeCaseIds: serializeCaseIds(body.includeCaseIds) ?? undefined,
    excludeCaseIds: serializeCaseIds(body.excludeCaseIds) ?? undefined,
    isIncluded: body.isIncluded ?? true
  };
}

export function buildRunInputFromPlanEntry(plan: PlanLike, entry: EntryLike): Pick<
  CreateRunWithInstancesInput,
  "includeAll" | "caseIds" | "excludedCaseIds" | "startedAt" | "dueOn" | "assignedTo"
> {
  assertPlanEntryIncluded(entry.isIncluded ?? true);
  const composition = resolvePlanEntryRunComposition({
    includeAll: entry.includeAll ?? true,
    includeCaseIds: parseStoredCaseIds(entry.includeCaseIds),
    excludeCaseIds: parseStoredCaseIds(entry.excludeCaseIds)
  });
  const scheduling = mergePlanScheduling(
    {
      startDate: entry.startDate,
      dueOn: entry.dueOn,
      assignedTo: entry.assignedTo ?? null
    },
    {
      startDate: plan.startDate,
      dueOn: plan.dueOn,
      assignedTo: plan.assignedTo ?? null
    }
  );
  return { ...composition, ...scheduling };
}

export async function persistEntryConfigurations(
  prisma: PrismaClient,
  projectId: bigint,
  entryId: bigint,
  configurationIds: bigint[],
  validateOnePerGroup: (selections: Array<{ configurationId: bigint; groupId: bigint }>) => void
) {
  if (configurationIds.length === 0) {
    await prisma.testPlanEntryConfiguration.deleteMany({ where: { planEntryId: entryId } });
    return configurationIds;
  }
  const selectedConfigurations = await prisma.configuration.findMany({
    where: {
      id: { in: configurationIds },
      deletedAt: null,
      isActive: true,
      group: { projectId, deletedAt: null }
    },
    select: { id: true, groupId: true }
  });
  if (selectedConfigurations.length !== configurationIds.length) {
    throw new AppError("VALIDATION_ERROR", "invalid configurationIds for this project", 400);
  }
  validateOnePerGroup(
    selectedConfigurations.map((row) => ({
      configurationId: row.id,
      groupId: row.groupId
    }))
  );
  await prisma.$transaction(async (tx) => {
    await tx.testPlanEntryConfiguration.deleteMany({ where: { planEntryId: entryId } });
    for (const configurationId of configurationIds) {
      await tx.testPlanEntryConfiguration.create({
        data: { planEntryId: entryId, configurationId }
      });
    }
  });
  return configurationIds;
}

export async function createRunForPlanEntry(input: {
  runsService: RunsService;
  projectId: bigint;
  plan: PlanLike;
  entry: EntryLike;
  suiteId: bigint;
}) {
  const runFields = buildRunInputFromPlanEntry(input.plan, input.entry);
  return input.runsService.createRunWithInstances({
    projectId: input.projectId,
    suiteId: input.suiteId,
    milestoneId: input.plan.milestoneId ?? null,
    name: `${input.plan.name} — ${input.entry.name}`,
    environment: input.entry.environment?.trim() ?? null,
    ...runFields
  });
}
