import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { testRailStatusMap } from "../../domain/testrailMapping.js";
import { projectRoles } from "../../domain/roles.js";
import { canMutateProject } from "../../domain/permissions.js";
import type { ProjectRole } from "../../domain/roles.js";
import {
  mapAttachmentForV2,
  buildSystemStatuses,
  mapCaseTemplatesForV2,
  mapConfigurations,
  mapCustomFieldsForV2,
  mapCustomStatuses,
  mapMilestone,
  mapPlan,
  buildCaseTypesCatalog,
  buildPrioritiesCatalog,
  mapLabelsForV2,
  mapProjectForV2,
  mapResultForV2,
  mapRoleForV2,
  mapSavedReportForV2,
  mapSectionForV2,
  mapSections,
  mapSuite,
  mapUserForV2,
  statusIdForCanonical
} from "./testrail.mappers.js";
import { SectionsService } from "../sections/sections.service.js";
import { SuitesService } from "../suites/suites.service.js";
import { sectionIdParamSchema } from "../sections/sections.schema.js";
import { suiteIdParamSchema } from "../suites/suites.schema.js";
import { TESTRAIL_V2_DEFERRED, TESTRAIL_V2_SUPPORTED } from "./testrail.supported.js";
import type { AuthService } from "../auth/auth.service.js";
import { caseIdParamSchema } from "../cases/cases.schema.js";
import type { CasesService } from "../cases/cases.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import type { ResultsService } from "../results/results.service.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { runIdParamSchema } from "../runs/runs.schema.js";
import type { RunsService } from "../runs/runs.service.js";
import type { TestStatus } from "../../domain/status.js";
import { ImportExportService, reportExportSchema } from "../importExport/importExport.routes.js";
import {
  buildTestRailListResponse,
  parseTestRailPagination,
  testRailQuerySuffix
} from "./testrail.pagination.js";

const updateCaseBodySchema = z.object({
  title: z.string().min(1).optional(),
  preconditions: z.string().nullable().optional(),
  priority: z.string().optional(),
  type_id: z.unknown().optional(),
  caseType: z.string().optional(),
  custom_steps: z.string().optional()
});

const addCaseBodySchema = updateCaseBodySchema.extend({
  title: z.string().min(1),
  labels: z.array(z.string()).optional()
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

const runReportParamSchema = z.object({
  reportId: z.coerce.bigint()
});

const addSuiteBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

const updateSuiteBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional()
});

const addSectionBodySchema = z.object({
  suite_id: z.coerce.bigint().optional(),
  suiteId: z.coerce.bigint().optional(),
  parent_id: z.coerce.bigint().nullable().optional(),
  parentId: z.coerce.bigint().nullable().optional(),
  name: z.string().min(1)
});

const updateSectionBodySchema = z.object({
  name: z.string().min(1).optional(),
  parent_id: z.coerce.bigint().nullable().optional(),
  parentId: z.coerce.bigint().nullable().optional()
});

const updateRunBodySchema = z.object({
  name: z.string().min(1).optional(),
  assignedto_id: z.coerce.bigint().nullable().optional(),
  assigned_to_id: z.coerce.bigint().nullable().optional(),
  assignedTo: z.coerce.bigint().nullable().optional()
});

const milestoneIdParamSchema = z.object({
  milestoneId: z.coerce.bigint()
});

const planIdParamSchema = z.object({
  planId: z.coerce.bigint()
});

const testIdParamSchema = z.object({
  testId: z.coerce.bigint()
});

function savedReportExportFilters(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const exportValue = (value as Record<string, unknown>).export;
  return exportValue && typeof exportValue === "object" && !Array.isArray(exportValue)
    ? (exportValue as Record<string, unknown>)
    : {};
}

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
  return statusIdForCanonical(status);
}

function mapCase(row: {
  id: bigint;
  sectionId: bigint;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  labels?: string[];
}) {
  const labels = (row.labels ?? []).map((label) => label.trim()).filter(Boolean);
  return {
    id: Number(row.id),
    section_id: Number(row.sectionId),
    title: row.title,
    priority: row.priority ?? null,
    type: row.caseType ?? null,
    custom_preconds: row.preconditions ?? null,
    labels: mapLabelsForV2(labels)
  };
}

async function listProjectLabelTitles(
  projectId: bigint,
  deps: {
    prisma?: PrismaClient;
    casesService: CasesService;
  }
): Promise<string[]> {
  if (deps.prisma) {
    const rows = await deps.prisma.$queryRaw<Array<{ title: string }>>`
      SELECT DISTINCT btrim(label) AS title
      FROM "TestCase", unnest(labels) AS label
      WHERE "projectId" = ${projectId} AND "deletedAt" IS NULL AND btrim(label) <> ''
      ORDER BY title
    `;
    return rows.map((row) => row.title);
  }
  const cases = await deps.casesService.listCases({ projectId });
  const titles = new Set<string>();
  for (const row of cases) {
    for (const label of row.labels ?? []) {
      const trimmed = label.trim();
      if (trimmed) titles.add(trimmed);
    }
  }
  return [...titles].sort((a, b) => a.localeCompare(b));
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

function sendPaginatedList<T>(
  reply: FastifyReply,
  query: Record<string, unknown>,
  input: { items: T[]; collectionKey: string; basePath: string }
) {
  const { limit, offset } = parseTestRailPagination(query);
  const suffix = testRailQuerySuffix(query);
  return reply.send(
    toJsonSafe(
      buildTestRailListResponse({
        items: input.items,
        limit,
        offset,
        collectionKey: input.collectionKey,
        basePath: input.basePath,
        querySuffix: suffix
      })
    )
  );
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
  const suitesService = new SuitesService(deps.catalog);
  const sectionsService = new SectionsService(deps.catalog);

  app.get("/api/v2", async (_req, reply) => {
    return reply.send(
      toJsonSafe({
        supported: [...TESTRAIL_V2_SUPPORTED],
        deferred: [...TESTRAIL_V2_DEFERRED],
        note: "High-traffic list endpoints (cases, runs, tests, results) return TestRail-style limit/offset envelopes; other list routes may still return bare arrays."
      })
    );
  });

  app.get("/api/v2/get_projects", async (_req, reply) => {
    const rows = await deps.catalog.listProjects();
    return reply.send(toJsonSafe(rows.map((p) => mapProjectForV2(p))));
  });

  app.get("/api/v2/get_project/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const row = await deps.catalog.getProject(projectId);
    if (!row) throw new AppError("NOT_FOUND", "project not found", 404);
    return reply.send(toJsonSafe(mapProjectForV2(row)));
  });

  app.get("/api/v2/get_suite/:suiteId", async (req, reply) => {
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const row = await deps.catalog.getSuite(suiteId);
    if (!row) throw new AppError("NOT_FOUND", "suite not found", 404);
    return reply.send(toJsonSafe(mapSuite(row)));
  });

  app.get("/api/v2/get_section/:sectionId", async (req, reply) => {
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const row = await deps.catalog.getSection(sectionId);
    if (!row) throw new AppError("NOT_FOUND", "section not found", 404);
    const peers = await deps.catalog.listSectionsBySuite(row.suiteId);
    return reply.send(toJsonSafe(mapSectionForV2(row, peers)));
  });

  app.get("/api/v2/get_milestone/:milestoneId", async (req, reply) => {
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_FOUND", "milestone not found", 404);
    const row = await deps.prisma.milestone.findFirst({
      where: { id: milestoneId, deletedAt: null }
    });
    if (!row) throw new AppError("NOT_FOUND", "milestone not found", 404);
    return reply.send(toJsonSafe(mapMilestone(row)));
  });

  app.get("/api/v2/get_plan/:planId", async (req, reply) => {
    const { planId } = planIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_FOUND", "plan not found", 404);
    const row = await deps.prisma.testPlan.findFirst({
      where: { id: planId, deletedAt: null }
    });
    if (!row) throw new AppError("NOT_FOUND", "plan not found", 404);
    return reply.send(toJsonSafe(mapPlan(row)));
  });

  app.get("/api/v2/get_case_types", async (_req, reply) => {
    return reply.send(toJsonSafe(buildCaseTypesCatalog()));
  });

  app.get("/api/v2/get_priorities", async (_req, reply) => {
    return reply.send(toJsonSafe(buildPrioritiesCatalog()));
  });

  app.get("/api/v2/get_case/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const row = await deps.casesService.getCase(caseId);
    return reply.send(toJsonSafe(mapCase(row)));
  });

  app.get("/api/v2/get_suites/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rows = await deps.catalog.listSuitesByProject(projectId);
    return reply.send(toJsonSafe(rows.map(mapSuite)));
  });

  app.get("/api/v2/get_sections/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = req.query as { suite_id?: string } | undefined;
    if (!query?.suite_id) {
      throw new AppError("VALIDATION_ERROR", "suite_id query parameter is required", 400);
    }
    const suiteId = BigInt(query.suite_id);
    const suites = await deps.catalog.listSuitesByProject(projectId);
    if (!suites.some((suite) => suite.id === suiteId)) {
      throw new AppError("NOT_FOUND", "suite not found in project", 404);
    }
    const rows = await deps.catalog.listSectionsBySuite(suiteId);
    return reply.send(toJsonSafe(mapSections(rows)));
  });

  app.get("/api/v2/get_milestones/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.milestone.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { id: "desc" },
        take: 250
      });
      return reply.send(toJsonSafe(rows.map(mapMilestone)));
    }
    return reply.send(toJsonSafe([]));
  });

  app.get("/api/v2/get_plans/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.testPlan.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { id: "desc" },
        take: 250
      });
      return reply.send(toJsonSafe(rows.map(mapPlan)));
    }
    return reply.send(toJsonSafe([]));
  });

  app.get("/api/v2/get_statuses", async (req, reply) => {
    const query = req.query as { project_id?: string } | undefined;
    if (!query?.project_id) {
      return reply.send(toJsonSafe(buildSystemStatuses()));
    }
    const projectId = BigInt(query.project_id);
    if (!deps.prisma) {
      return reply.send(toJsonSafe(buildSystemStatuses()));
    }
    const rows = await deps.prisma.customStatus.findMany({
      where: { projectId, deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
    });
    return reply.send(toJsonSafe(mapCustomStatuses(rows)));
  });

  app.get("/api/v2/get_configs/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.configurationGroup.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: {
        configurations: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
        }
      }
    });
    return reply.send(toJsonSafe(mapConfigurations(rows)));
  });

  app.get("/api/v2/get_case_fields/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.customField.findMany({
      where: { projectId, deletedAt: null, isActive: true, scope: "case" },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
    });
    return reply.send(toJsonSafe(mapCustomFieldsForV2(rows)));
  });

  app.get("/api/v2/get_result_fields/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.customField.findMany({
      where: { projectId, deletedAt: null, isActive: true, scope: "result" },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
    });
    return reply.send(toJsonSafe(mapCustomFieldsForV2(rows)));
  });

  app.get("/api/v2/get_templates/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.caseTemplate.findMany({
      where: { projectId, deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
    });
    return reply.send(toJsonSafe(mapCaseTemplatesForV2(rows)));
  });

  app.get("/api/v2/get_users", async (_req, reply) => {
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 250
    });
    return reply.send(toJsonSafe(rows.map(mapUserForV2)));
  });

  app.get("/api/v2/get_users/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.projectMember.findMany({
      where: { projectId, deletedAt: null, user: { deletedAt: null } },
      orderBy: [{ user: { name: "asc" } }, { id: "asc" }],
      include: { user: true },
      take: 250
    });
    return reply.send(toJsonSafe(rows.map((row) => mapUserForV2(row.user))));
  });

  app.get("/api/v2/get_reports/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.savedReport.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 250
    });
    return reply.send(toJsonSafe(rows.map(mapSavedReportForV2)));
  });

  app.get("/api/v2/get_roles", async (_req, reply) => {
    return reply.send(toJsonSafe(projectRoles.map(mapRoleForV2)));
  });

  app.get("/api/v2/get_labels/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const titles = await listProjectLabelTitles(projectId, deps);
    return reply.send(toJsonSafe(mapLabelsForV2(titles)));
  });

  app.get("/api/v2/get_groups", async (_req, reply) => {
    return reply.send(toJsonSafe([]));
  });

  app.get("/api/v2/get_shared_steps/:projectId", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe([]));
  });

  app.get("/api/v2/get_attachments_for_case/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.attachment.findMany({
      where: { entityType: "case", entityId: caseId, deletedAt: null },
      orderBy: { id: "desc" },
      take: 250
    });
    return reply.send(toJsonSafe(rows.map(mapAttachmentForV2)));
  });

  app.get("/api/v2/get_attachments_for_result/:resultId", async (req, reply) => {
    const { resultId } = z.object({ resultId: z.coerce.bigint() }).parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.attachment.findMany({
      where: { resultId, entityType: "result", deletedAt: null },
      orderBy: { id: "desc" },
      take: 250
    });
    return reply.send(toJsonSafe(rows.map(mapAttachmentForV2)));
  });

  app.post("/api/v2/run_report/:reportId", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { reportId } = runReportParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "run_report requires prisma mode", 501);
    const saved = await deps.prisma.savedReport.findFirst({
      where: { id: reportId, deletedAt: null }
    });
    if (!saved) throw new AppError("NOT_FOUND", "report not found", 404);
    const member = await deps.prisma.projectMember.findFirst({
      where: { projectId: saved.projectId, userId: user.id, deletedAt: null },
      select: { role: true }
    });
    if (!member || !canMutateProject(member.role as ProjectRole)) {
      throw new AppError("FORBIDDEN", "insufficient project role for report execution", 403);
    }
    const exportInput = reportExportSchema.parse({
      reportType: saved.reportType,
      ...savedReportExportFilters(saved.filters)
    });
    const importExport = new ImportExportService(deps.prisma);
    const { exported, job } = await importExport.buildAdHocReportExport(saved.projectId, user.id, exportInput);
    return reply.send(
      toJsonSafe({
        report_id: Number(saved.id),
        project_id: Number(saved.projectId),
        job_id: Number(job.id),
        status: "completed",
        format: exportInput.format,
        total_rows: exported.totalRows,
        report_url: `/api/projects/${saved.projectId.toString()}/export-jobs/${job.id.toString()}/download`,
        download_url: `/api/projects/${saved.projectId.toString()}/export-jobs/${job.id.toString()}/download`
      })
    );
  });

  app.get("/api/v2/get_cases/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = (req.query ?? {}) as Record<string, unknown>;
    const suiteId = query.suite_id != null && String(query.suite_id) !== "" ? BigInt(String(query.suite_id)) : undefined;
    const sectionId =
      query.section_id != null && String(query.section_id) !== "" ? BigInt(String(query.section_id)) : undefined;
    const rows = await deps.casesService.listCases({
      projectId,
      suiteId,
      sectionId
    });
    return sendPaginatedList(reply, query, {
      items: rows.map(mapCase),
      collectionKey: "cases",
      basePath: `/api/v2/get_cases/${projectId.toString()}`
    });
  });

  app.get("/api/v2/get_runs/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = (req.query ?? {}) as Record<string, unknown>;
    const rows = await deps.repo.listRunsByProject(projectId);
    return sendPaginatedList(reply, query, {
      items: rows.map(mapRun),
      collectionKey: "runs",
      basePath: `/api/v2/get_runs/${projectId.toString()}`
    });
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
      preconditions: body.preconditions ?? undefined,
      labels: body.labels
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

  app.post("/api/v2/add_suite/:projectId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = addSuiteBodySchema.parse(req.body ?? {});
    const created = await suitesService.createSuite({
      projectId,
      name: body.name,
      description: body.description
    });
    return reply.send(toJsonSafe(mapSuite(created)));
  });

  app.post("/api/v2/update_suite/:suiteId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const body = updateSuiteBodySchema.parse(req.body ?? {});
    const updated = await suitesService.updateSuite(suiteId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? undefined } : {})
    });
    return reply.send(toJsonSafe(mapSuite(updated)));
  });

  app.post("/api/v2/add_section/:projectId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = addSectionBodySchema.parse(req.body ?? {});
    const suiteId = body.suite_id ?? body.suiteId;
    if (!suiteId) {
      throw new AppError("VALIDATION_ERROR", "suite_id is required", 400);
    }
    const suites = await deps.catalog.listSuitesByProject(projectId);
    if (!suites.some((suite) => suite.id === suiteId)) {
      throw new AppError("NOT_FOUND", "suite not found in project", 404);
    }
    const parentSectionId = body.parent_id ?? body.parentId ?? null;
    const created = await sectionsService.createSection({
      suiteId,
      parentSectionId,
      name: body.name
    });
    const peers = await deps.catalog.listSectionsBySuite(suiteId);
    return reply.send(toJsonSafe(mapSectionForV2(created, peers)));
  });

  app.post("/api/v2/update_section/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const body = updateSectionBodySchema.parse(req.body ?? {});
    const parentSectionId =
      body.parent_id !== undefined ? body.parent_id : body.parentId !== undefined ? body.parentId : undefined;
    const updated = await sectionsService.updateSection(sectionId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(parentSectionId !== undefined ? { parentSectionId } : {})
    });
    const peers = await deps.catalog.listSectionsBySuite(updated.suiteId);
    return reply.send(toJsonSafe(mapSectionForV2(updated, peers)));
  });

  app.post("/api/v2/delete_section/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    await sectionsService.deleteSection(sectionId);
    return reply.send(toJsonSafe({}));
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
    const query = (req.query ?? {}) as Record<string, unknown>;
    const rows = await deps.repo.listInstancesForRun(runId);
    return sendPaginatedList(reply, query, {
      items: rows.map(mapTest),
      collectionKey: "tests",
      basePath: `/api/v2/get_tests/${runId.toString()}`
    });
  });

  app.get("/api/v2/get_results/:testId", async (req, reply) => {
    const { testId } = testIdParamSchema.parse(req.params);
    const query = (req.query ?? {}) as Record<string, unknown>;
    const rows = await deps.resultsService.listResultsForTestInstance(testId);
    return sendPaginatedList(reply, query, {
      items: rows.map(mapResultForV2),
      collectionKey: "results",
      basePath: `/api/v2/get_results/${testId.toString()}`
    });
  });

  app.get("/api/v2/get_results_for_case/:runId/:caseId", async (req, reply) => {
    const { runId } = runIdParamSchema.parse(req.params);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const query = (req.query ?? {}) as Record<string, unknown>;
    const run = await deps.repo.getRun(runId);
    if (!run) throw new AppError("NOT_FOUND", "run not found", 404);
    const instance = await deps.repo.transaction(async (tx) => tx.getTestInstanceByCaseInRun(runId, caseId));
    if (!instance) {
      throw new AppError("NOT_FOUND", "case not found in run", 404);
    }
    const rows = await deps.repo.listResultsForTestInstance(instance.id);
    return sendPaginatedList(reply, query, {
      items: rows.map(mapResultForV2),
      collectionKey: "results",
      basePath: `/api/v2/get_results_for_case/${runId.toString()}/${caseId.toString()}`
    });
  });

  app.get("/api/v2/get_results_for_run/:runId", async (req, reply) => {
    const { runId } = runIdParamSchema.parse(req.params);
    const query = (req.query ?? {}) as Record<string, unknown>;
    const run = await deps.repo.getRun(runId);
    if (!run) throw new AppError("NOT_FOUND", "run not found", 404);
    const instances = await deps.repo.listInstancesForRun(runId);
    const rows = [];
    for (const instance of instances) {
      const results = await deps.repo.listResultsForTestInstance(instance.id);
      rows.push(...results.map(mapResultForV2));
    }
    rows.sort((left, right) => right.created_on - left.created_on);
    return sendPaginatedList(reply, query, {
      items: rows,
      collectionKey: "results",
      basePath: `/api/v2/get_results_for_run/${runId.toString()}`
    });
  });

  app.post("/api/v2/close_run/:runId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const closed = await deps.runsService.closeRun(runId);
    return reply.send(toJsonSafe(mapRun(closed)));
  });

  app.post("/api/v2/update_run/:runId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunBodySchema.parse(req.body ?? {});
    const assignedTo = body.assignedto_id ?? body.assigned_to_id ?? body.assignedTo;
    const updated = await deps.runsService.updateRun(runId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(assignedTo !== undefined ? { assignedTo } : {})
    });
    return reply.send(toJsonSafe(mapRun(updated)));
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
