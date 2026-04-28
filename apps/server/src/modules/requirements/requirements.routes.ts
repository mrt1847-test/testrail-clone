import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { caseIdParamSchema } from "../cases/cases.schema.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

const requirementIdParamSchema = z.object({
  requirementId: z.coerce.bigint()
});

const createRequirementSchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  status: z.enum(["active", "changed", "deprecated"]).optional(),
  externalUrl: z.string().url().optional()
});

const patchRequirementSchema = z.object({
  key: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "changed", "deprecated"]).optional(),
  externalUrl: z.string().url().nullable().optional()
});

const listRequirementsQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["active", "changed", "deprecated"]).optional()
});

export async function registerRequirementsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/requirements", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const { q, status } = listRequirementsQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe(paged([], page, pageSize)));

    const where = {
      projectId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { key: { contains: q, mode: "insensitive" as const } },
              { title: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [rows, total] = await deps.prisma.$transaction([
      deps.prisma.requirement.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      deps.prisma.requirement.count({ where })
    ]);
    return reply.send(
      toJsonSafe({
        data: rows,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.post("/api/projects/:projectId/requirements", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createRequirementSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "requirements API needs prisma mode", 501);
    const created = await deps.prisma.requirement.create({
      data: {
        projectId,
        key: body.key,
        title: body.title,
        description: body.description,
        status: body.status ?? "active",
        externalUrl: body.externalUrl
      }
    });
    return reply.send(toJsonSafe(ok(created)));
  });

  app.patch("/api/requirements/:requirementId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { requirementId } = requirementIdParamSchema.parse(req.params);
    const body = patchRequirementSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "requirements API needs prisma mode", 501);
    const found = await deps.prisma.requirement.findFirst({
      where: { id: requirementId, deletedAt: null }
    });
    if (!found) throw new AppError("NOT_FOUND", `requirement ${requirementId.toString()} not found`, 404);
    const updated = await deps.prisma.requirement.update({
      where: { id: requirementId },
      data: {
        ...(body.key !== undefined ? { key: body.key } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.externalUrl !== undefined ? { externalUrl: body.externalUrl } : {})
      }
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/requirements/:requirementId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { requirementId } = requirementIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "requirements API needs prisma mode", 501);
    const found = await deps.prisma.requirement.findFirst({
      where: { id: requirementId, deletedAt: null }
    });
    if (!found) throw new AppError("NOT_FOUND", `requirement ${requirementId.toString()} not found`, 404);
    await deps.prisma.requirement.update({
      where: { id: requirementId },
      data: { deletedAt: new Date() }
    });
    return reply.status(204).send();
  });

  app.post("/api/cases/:caseId/requirements/:requirementId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { requirementId } = requirementIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "requirements API needs prisma mode", 501);
    const [testCase, requirement] = await Promise.all([
      deps.prisma.testCase.findFirst({ where: { id: caseId, deletedAt: null }, select: { projectId: true } }),
      deps.prisma.requirement.findFirst({
        where: { id: requirementId, deletedAt: null },
        select: { projectId: true }
      })
    ]);
    if (!testCase) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    if (!requirement) throw new AppError("NOT_FOUND", `requirement ${requirementId.toString()} not found`, 404);
    if (testCase.projectId !== requirement.projectId) {
      throw new AppError("VALIDATION_ERROR", "case and requirement must belong to same project", 400);
    }
    const linked = await deps.prisma.caseRequirement.upsert({
      where: { caseId_requirementId: { caseId, requirementId } },
      update: {},
      create: { caseId, requirementId }
    });
    return reply.send(toJsonSafe(ok(linked)));
  });

  app.delete("/api/cases/:caseId/requirements/:requirementId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { requirementId } = requirementIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "requirements API needs prisma mode", 501);
    await deps.prisma.caseRequirement.deleteMany({
      where: { caseId, requirementId }
    });
    return reply.status(204).send();
  });
}
