import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { AppError } from "../../common/errors/appError.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { CasesService } from "../cases/cases.service.js";
import { parseGherkinFeatureText, serializeFeatureFile } from "../../domain/bdd/gherkin.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  resolveInMemoryCaseTemplateId,
  resolveProjectCaseTemplateId
} from "../settings/caseTemplates.service.js";
import { caseTemplates } from "../settings/settings.shared.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

const importFeatureSchema = z.object({
  sectionId: z.coerce.bigint(),
  featureText: z.string().min(1),
  createOneCasePerFeature: z.boolean().optional().default(true)
});

const exportFeatureQuerySchema = z.object({
  sectionId: z.coerce.bigint().optional(),
  caseId: z.coerce.bigint().optional()
});

async function resolveBddTemplateId(
  deps: { prisma?: PrismaClient; catalog: ProjectsRepository },
  projectId: bigint
) {
  if (deps.prisma) {
    const bdd = await deps.prisma.caseTemplate.findFirst({
      where: {
        projectId,
        deletedAt: null,
        isActive: true,
        systemKey: "behaviour_driven_development"
      },
      select: { id: true }
    });
    if (bdd) return bdd.id;
    return resolveProjectCaseTemplateId(deps.prisma, projectId, null);
  }
  const bdd = caseTemplates.find(
    (row) => row.projectId === projectId && row.systemKey === "behaviour_driven_development"
  );
  if (bdd) return bdd.id;
  return resolveInMemoryCaseTemplateId(projectId, caseTemplates, null);
}

export async function registerBddRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; catalog: ProjectsRepository; casesService: CasesService; authService: AuthService }
) {
  app.post("/api/projects/:projectId/bdd/features/import", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "cases.write" });
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = importFeatureSchema.parse(req.body ?? {});
    const section = await deps.catalog.getSection(body.sectionId);
    if (!section) throw new AppError("NOT_FOUND", "section not found", 404);
    const suite = await deps.catalog.getSuite(section.suiteId);
    if (!suite || suite.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "section not found in project", 404);
    }

    const templateId = await resolveBddTemplateId(deps, projectId);
    const features = parseGherkinFeatureText(body.featureText);
    if (features.length === 0) {
      throw new AppError("VALIDATION_ERROR", "no scenarios found in feature text", 400);
    }

    const createdCases: Array<{ caseId: bigint; title: string; scenarios: number }> = [];
    if (body.createOneCasePerFeature) {
      for (const feature of features) {
        if (feature.scenarios.length === 0) continue;
        const created = await deps.catalog.createCase({
          projectId,
          suiteId: suite.id,
          sectionId: body.sectionId,
          title: feature.name,
          caseTemplateId: templateId,
          customValues: {}
        });
        await deps.catalog.replaceCaseScenarios(
          created.id,
          feature.scenarios.map((scenario) => ({ name: scenario.name, content: scenario.content }))
        );
        createdCases.push({
          caseId: created.id,
          title: created.title,
          scenarios: feature.scenarios.length
        });
      }
    } else {
      for (const feature of features) {
        for (const scenario of feature.scenarios) {
          const created = await deps.catalog.createCase({
            projectId,
            suiteId: suite.id,
            sectionId: body.sectionId,
            title: `${feature.name}: ${scenario.name}`,
            caseTemplateId: templateId,
            customValues: {}
          });
          await deps.catalog.replaceCaseScenarios(created.id, [
            { name: scenario.name, content: scenario.content }
          ]);
          createdCases.push({ caseId: created.id, title: created.title, scenarios: 1 });
        }
      }
    }

    return reply.send(
      toJsonSafe(
        ok({
          importedCases: createdCases.length,
          cases: createdCases.map((row) => ({
            caseId: row.caseId,
            title: row.title,
            scenarios: row.scenarios
          }))
        })
      )
    );
  });

  app.get("/api/projects/:projectId/bdd/features/export", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = exportFeatureQuerySchema.parse(req.query ?? {});
    if (!query.caseId && !query.sectionId) {
      throw new AppError("VALIDATION_ERROR", "caseId or sectionId is required", 400);
    }

    const cases = query.caseId
      ? [await deps.catalog.getCase(query.caseId)].filter((row): row is NonNullable<typeof row> => Boolean(row))
      : await deps.catalog.listCases({ projectId, sectionId: query.sectionId, sectionScope: "subtree", state: "active" });

    const blocks: string[] = [];
    for (const testCase of cases) {
      const scenarios = await deps.catalog.listCaseScenarios(testCase.id);
      if (scenarios.length === 0) continue;
      blocks.push(
        serializeFeatureFile({
          featureName: testCase.title,
          scenarios: scenarios.map((scenario) => ({ name: scenario.name, content: scenario.content }))
        }).trim()
      );
    }

    const featureText = blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "Feature: Empty export\n\n";
    reply.header("content-type", "text/plain; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="project-${projectId.toString()}-bdd.feature"`
    );
    return reply.send(featureText);
  });

  app.get("/api/projects/:projectId/bdd/summary", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const cases = await deps.catalog.listCases({ projectId, state: "active" });
    let casesWithScenarios = 0;
    let scenarioCount = 0;
    for (const testCase of cases) {
      const scenarios = await deps.catalog.listCaseScenarios(testCase.id);
      if (scenarios.length === 0) continue;
      casesWithScenarios += 1;
      scenarioCount += scenarios.length;
    }
    return reply.send(
      ok({
        totalCases: cases.length,
        casesWithScenarios,
        scenarioCount
      })
    );
  });
}
