import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrintDocument } from "../../domain/printDocument.js";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { requireProjectPermission } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { MAX_CASES_PER_PRINT } from "../../domain/printDocument.js";
import { renderPrintDocumentHtml } from "../../domain/printHtml.js";
import type { AuthService } from "../auth/auth.service.js";
import type { CasesService } from "../cases/cases.service.js";
import { caseIdParamSchema } from "../cases/cases.schema.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { runIdParamSchema } from "../runs/runs.schema.js";
import { milestoneIdParamSchema } from "../milestones/milestones.schema.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import {
  buildCasePrintDocument,
  buildCasesPrintDocument,
  buildMilestonePrintDocument,
  buildPlanPrintDocument,
  buildRunPrintDocument
} from "./printExport.service.js";
import { buildReportPrintDocument, reportPrintQuerySchema } from "./reportPrint.service.js";

const printQuerySchema = z.object({
  format: z.enum(["json", "html"]).default("json"),
  caseIds: z.string().optional()
});

const casesPrintBodySchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1).max(MAX_CASES_PER_PRINT)
});

const planIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  planId: z.coerce.bigint()
});

function parseCaseIdsQuery(raw: string | undefined) {
  if (!raw?.trim()) return [];
  const ids: bigint[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    ids.push(BigInt(trimmed));
  }
  return ids;
}

function mapPrintError(error: unknown): never {
  if (error instanceof Error) {
    if (
      error.message === "RUN_NOT_FOUND" ||
      error.message === "PLAN_NOT_FOUND" ||
      error.message === "MILESTONE_NOT_FOUND"
    ) {
      throw new AppError("NOT_FOUND", error.message.replace(/_/g, " ").toLowerCase(), 404);
    }
    if (error.message === "PLAN_PRINT_REQUIRES_PRISMA") {
      throw new AppError("NOT_IMPLEMENTED", "plan print requires database mode", 501);
    }
    if (error.message === "NO_CASES_SELECTED" || error.message === "NO_CASES_FOUND") {
      throw new AppError("NOT_FOUND", "no cases found for print", 404);
    }
    if (error.message === "TOO_MANY_CASES") {
      throw new AppError("VALIDATION_ERROR", `at most ${MAX_CASES_PER_PRINT} cases per print`, 400);
    }
  }
  throw error;
}

async function sendPrintDocument(reply: FastifyReply, document: PrintDocument, format: "json" | "html") {
  if (format === "html") {
    return reply.type("text/html; charset=utf-8").send(renderPrintDocumentHtml(document));
  }
  return reply.send(toJsonSafe(ok(document)));
}

function mapReportPrintError(error: unknown): never {
  if (error instanceof z.ZodError) {
    throw new AppError("VALIDATION_ERROR", error.issues[0]?.message ?? "invalid report print query", 400);
  }
  if (error instanceof Error && error.message === "UNSUPPORTED_REPORT_PRINT") {
    throw new AppError("VALIDATION_ERROR", "unsupported report type for print", 400);
  }
  mapPrintError(error);
}

export async function registerPrintRoutes(
  app: FastifyInstance,
  deps: {
    prisma?: PrismaClient;
    repo: RunsRepository;
    casesService: CasesService;
    authService: AuthService;
    catalog?: ProjectsRepository;
  }
) {
  const printDeps = { prisma: deps.prisma, repo: deps.repo, casesService: deps.casesService };
  const authDeps = { authService: deps.authService, prisma: deps.prisma };

  app.get("/api/projects/:projectId/reports/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "runs.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = reportPrintQuerySchema.parse(req.query ?? {});
    const format = printQuerySchema.parse(req.query ?? {}).format;
    try {
      const document = await buildReportPrintDocument(projectId, query, {
        prisma: deps.prisma,
        repo: deps.repo,
        catalog: deps.catalog
      });
      return sendPrintDocument(reply, document, format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapReportPrintError(error);
    }
  });

  app.get("/api/cases/:caseId/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "cases.read");
    const { caseId } = caseIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildCasePrintDocument(caseId, printDeps);
      return sendPrintDocument(reply, document, query.format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/cases/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "cases.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    const caseIds = parseCaseIdsQuery(query.caseIds);
    if (caseIds.length === 0) {
      throw new AppError("VALIDATION_ERROR", "caseIds query parameter is required", 400);
    }
    try {
      const document = await buildCasesPrintDocument(projectId, caseIds, printDeps);
      return sendPrintDocument(reply, document, query.format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.post("/api/projects/:projectId/cases/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "cases.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    const body = casesPrintBodySchema.parse(req.body ?? {});
    try {
      const document = await buildCasesPrintDocument(projectId, body.caseIds, printDeps);
      return sendPrintDocument(reply, document, query.format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/runs/:runId/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "runs.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildRunPrintDocument(projectId, runId, printDeps);
      return sendPrintDocument(reply, document, query.format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/plans/:planId/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "runs.read");
    const params = planIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildPlanPrintDocument(params.projectId, params.planId, printDeps);
      return sendPrintDocument(reply, document, query.format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/milestones/:milestoneId/print", async (req, reply) => {
    await requireProjectPermission(req, authDeps, "runs.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildMilestonePrintDocument(projectId, milestoneId, printDeps);
      return sendPrintDocument(reply, document, query.format);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });
}
