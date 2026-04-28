import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { testRailStatusMap } from "../../domain/testrailMapping.js";
import type { AuthService } from "../auth/auth.service.js";
import { caseIdParamSchema, sectionIdParamSchema } from "../cases/cases.schema.js";
import type { CasesService } from "../cases/cases.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import type { ResultsService } from "../results/results.service.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { runIdParamSchema } from "../runs/runs.schema.js";
import type { RunsService } from "../runs/runs.service.js";
import type { TestStatus } from "../../domain/status.js";

const updateCaseBodySchema = z.object({
  title: z.string().min(1).optional(),
  preconditions: z.string().nullable().optional(),
  priority: z.string().optional(),
  type_id: z.unknown().optional(),
  caseType: z.string().optional(),
  custom_steps: z.string().optional()
});

const addCaseBodySchema = updateCaseBodySchema.extend({
  title: z.string().min(1)
});

const addRunBodySchema = z.object({
  suite_id: z.coerce.bigint().optional(),
  suiteId: z.coerce.bigint().optional(),
  name: z.string().min(1),
  include_all: z.boolean().optional(),
  includeAll: z.boolean().optional(),
  case_ids: z.array(z.coerce.bigint()).optional(),
  caseIds: z.array(z.coerce.bigint()).optional()
});

const resultBodySchema = z.object({
  status_id: z.coerce.number().int().optional(),
  status: z.enum(["untested", "passed", "failed", "blocked", "retest"]).optional(),
  comment: z.string().optional(),
  elapsed: z.string().optional(),
  version: z.string().optional(),
  defects: z.string().or(z.array(z.string())).optional()
});

const bulkResultsBodySchema = z.object({
  results: z.array(
    resultBodySchema.extend({
      case_id: z.coerce.bigint()
    })
  )
});

function toStatus(input: z.infer<typeof resultBodySchema>): TestStatus {
  if (input.status) return input.status;
  if (input.status_id != null) {
    const mapped = testRailStatusMap[input.status_id];
    if (mapped) return mapped;
  }
  throw new AppError("VALIDATION_ERROR", "status_id or status is required", 400);
}

function splitDefects(value: string | string[] | undefined) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function statusId(status: string) {
  const found = Object.entries(testRailStatusMap).find(([, value]) => value === status);
  return found ? Number(found[0]) : 3;
}

function mapCase(row: {
  id: bigint;
  sectionId: bigint;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
}) {
  return {
    id: Number(row.id),
    section_id: Number(row.sectionId),
    title: row.title,
    priority: row.priority ?? null,
    type: row.caseType ?? null,
    custom_preconds: row.preconditions ?? null
  };
}

function mapRun(row: {
  id: bigint;
  projectId: bigint;
  suiteId: bigint;
  name: string;
  includeAll: boolean;
  status: string;
}) {
  return {
    id: Number(row.id),
    project_id: Number(row.projectId),
    suite_id: Number(row.suiteId),
    name: row.name,
    include_all: row.includeAll,
    is_completed: row.status === "closed"
  };
}

function mapTest(row: {
  id: bigint;
  caseId: bigint;
  runId: bigint;
  status: string;
  titleSnapshot: string;
  prioritySnapshot?: string | null;
  typeSnapshot?: string | null;
}) {
  return {
    id: Number(row.id),
    case_id: Number(row.caseId),
    run_id: Number(row.runId),
    status_id: statusId(row.status),
    title: row.titleSnapshot,
    priority: row.prioritySnapshot ?? null,
    type: row.typeSnapshot ?? null
  };
}

export async function registerTestRailRoutes(
  app: FastifyInstance,
  deps: {
    authService: AuthService;
    casesService: CasesService;
    runsService: RunsService;
    resultsService: ResultsService;
    catalog: ProjectsRepository;
    repo: RunsRepository;
    prisma?: PrismaClient;
  }
) {
  app.get("/api/v2/get_case/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const row = await deps.casesService.getCase(caseId);
    return reply.send(toJsonSafe(mapCase(row)));
  });

  app.get("/api/v2/get_cases/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = req.query as { suite_id?: string; section_id?: string } | undefined;
    const rows = await deps.casesService.listCases({
      projectId,
      suiteId: query?.suite_id ? BigInt(query.suite_id) : undefined,
      sectionId: query?.section_id ? BigInt(query.section_id) : undefined
    });
    return reply.send(toJsonSafe(rows.map(mapCase)));
  });

  app.post("/api/v2/add_case/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const body = addCaseBodySchema.parse(req.body ?? {});
    const created = await deps.casesService.createCase({
      sectionId,
      title: body.title,
      priority: body.priority,
      caseType: body.caseType,
      preconditions: body.preconditions ?? undefined
    });
    return reply.send(toJsonSafe(mapCase(created)));
  });

  app.post("/api/v2/update_case/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = updateCaseBodySchema.parse(req.body ?? {});
    const updated = await deps.casesService.updateCase(caseId, {
      title: body.title,
      priority: body.priority,
      caseType: body.caseType,
      preconditions: body.preconditions
    });
    return reply.send(toJsonSafe(mapCase(updated)));
  });

  app.get("/api/v2/get_run/:runId", async (req, reply) => {
    const { runId } = runIdParamSchema.parse(req.params);
    const run = await deps.repo.getRun(runId);
    if (!run) throw new AppError("NOT_FOUND", "run not found", 404);
    return reply.send(toJsonSafe(mapRun(run)));
  });

  app.post("/api/v2/add_run/:projectId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = addRunBodySchema.parse(req.body ?? {});
    const suiteId = body.suite_id ?? body.suiteId ?? (await deps.catalog.listSuitesByProject(projectId))[0]?.id;
    if (!suiteId) throw new AppError("VALIDATION_ERROR", "suite_id is required", 400);
    const includeAll = body.include_all ?? body.includeAll ?? true;
    const caseIds = body.case_ids ?? body.caseIds;
    const created = await deps.runsService.createRunWithInstances({
      projectId,
      suiteId,
      name: body.name,
      includeAll,
      caseIds
    });
    return reply.send(toJsonSafe(mapRun(created.run)));
  });

  app.get("/api/v2/get_tests/:runId", async (req, reply) => {
    const { runId } = runIdParamSchema.parse(req.params);
    const rows = await deps.repo.listInstancesForRun(runId);
    return reply.send(toJsonSafe(rows.map(mapTest)));
  });

  app.post("/api/v2/add_result_for_case/:runId/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = resultBodySchema.parse(req.body ?? {});
    const created = await deps.resultsService.addResultForCaseInRun(runId, caseId, {
      status: toStatus(body),
      comment: body.comment,
      elapsed: body.elapsed,
      version: body.version,
      defects: splitDefects(body.defects),
      source: "api"
    });
    return reply.send(toJsonSafe({ id: Number(created.id), test_id: Number(created.testInstanceId) }));
  });

  app.post("/api/v2/add_results_for_cases/:runId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = bulkResultsBodySchema.parse(req.body ?? {});
    const result = await deps.resultsService.bulkAddResults({
      runId,
      atomic: false,
      results: body.results.map((item) => ({
        caseId: item.case_id,
        status: toStatus(item),
        comment: item.comment,
        elapsed: item.elapsed,
        version: item.version,
        defects: splitDefects(item.defects),
        source: "api"
      }))
    });
    return reply.send(
      toJsonSafe({
        run_id: Number(result.runId),
        total: result.total,
        saved: result.saved,
        failed: result.failed,
        items: result.items.map((item) => ({
          ...item,
          case_id: Number(item.caseId),
          test_id: "testId" in item ? Number(item.testId) : undefined,
          result_id: "resultId" in item ? Number(item.resultId) : undefined
        }))
      })
    );
  });
}
