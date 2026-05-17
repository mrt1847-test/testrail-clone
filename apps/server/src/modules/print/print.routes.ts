import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { renderPrintDocumentHtml } from "../../domain/printHtml.js";
import type { CasesService } from "../cases/cases.service.js";
import { caseIdParamSchema } from "../cases/cases.schema.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { runIdParamSchema } from "../runs/runs.schema.js";
import { milestoneIdParamSchema } from "../milestones/milestones.schema.js";
import {
  buildCasePrintDocument,
  buildMilestonePrintDocument,
  buildPlanPrintDocument,
  buildRunPrintDocument
} from "./printExport.service.js";

const printQuerySchema = z.object({
  format: z.enum(["json", "html"]).default("json")
});

const planIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  planId: z.coerce.bigint()
});

function mapPrintError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "RUN_NOT_FOUND" || error.message === "PLAN_NOT_FOUND" || error.message === "MILESTONE_NOT_FOUND") {
      throw new AppError("NOT_FOUND", error.message.replace(/_/g, " ").toLowerCase(), 404);
    }
    if (error.message === "PLAN_PRINT_REQUIRES_PRISMA") {
      throw new AppError("NOT_IMPLEMENTED", "plan print requires database mode", 501);
    }
  }
  throw error;
}

export async function registerPrintRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; repo: RunsRepository; casesService: CasesService }
) {
  const printDeps = { prisma: deps.prisma, repo: deps.repo, casesService: deps.casesService };

  app.get("/api/cases/:caseId/print", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildCasePrintDocument(caseId, printDeps);
      if (query.format === "html") {
        return reply.type("text/html; charset=utf-8").send(renderPrintDocumentHtml(document));
      }
      return reply.send(toJsonSafe(ok(document)));
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/runs/:runId/print", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildRunPrintDocument(projectId, runId, printDeps);
      if (query.format === "html") {
        return reply.type("text/html; charset=utf-8").send(renderPrintDocumentHtml(document));
      }
      return reply.send(toJsonSafe(ok(document)));
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/plans/:planId/print", async (req, reply) => {
    const params = planIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildPlanPrintDocument(params.projectId, params.planId, printDeps);
      if (query.format === "html") {
        return reply.type("text/html; charset=utf-8").send(renderPrintDocumentHtml(document));
      }
      return reply.send(toJsonSafe(ok(document)));
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });

  app.get("/api/projects/:projectId/milestones/:milestoneId/print", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);
    const query = printQuerySchema.parse(req.query ?? {});
    try {
      const document = await buildMilestonePrintDocument(projectId, milestoneId, printDeps);
      if (query.format === "html") {
        return reply.type("text/html; charset=utf-8").send(renderPrintDocumentHtml(document));
      }
      return reply.send(toJsonSafe(ok(document)));
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapPrintError(error);
    }
  });
}
