import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { CasesService } from "./cases.service.js";
import {
  caseIdParamSchema,
  createCaseSchema,
  createCaseStepSchema,
  listCasesQuerySchema,
  projectIdParamSchema,
  sectionIdParamSchema,
  stepIdParamSchema,
  updateCaseSchema,
  updateCaseStepSchema
} from "./cases.schema.js";

function parseIfMatchVersion(value?: string | string[]): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const normalized = raw.replace(/^W\//i, "").replace(/"/g, "").trim();
  const num = Number(normalized);
  if (!Number.isInteger(num) || num < 1) return undefined;
  return num;
}

type ScalarCustomValue = string | number | boolean | null;
type CustomValues = Record<string, ScalarCustomValue>;

function asCustomValues(value: unknown): CustomValues | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CustomValues = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      out[key] = item;
    }
  }
  return out;
}

function fieldOptions(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function projectIdForSection(prisma: PrismaClient, sectionId: bigint) {
  const row = await prisma.section.findFirst({
    where: { id: sectionId, deletedAt: null },
    select: { suite: { select: { projectId: true } } }
  });
  return row?.suite.projectId ?? null;
}

async function projectIdForCase(prisma: PrismaClient, caseId: bigint) {
  const row = await prisma.testCase.findFirst({
    where: { id: caseId, deletedAt: null },
    select: { projectId: true }
  });
  return row?.projectId ?? null;
}

async function validateCaseCustomValues(prisma: PrismaClient | undefined, projectId: bigint | null, values: CustomValues | undefined) {
  if (!prisma || !projectId || values === undefined) return values;
  const fields = await prisma.customField.findMany({
    where: { projectId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
  });
  const known = new Map(fields.map((field) => [field.systemName, field]));
  const sanitized: CustomValues = {};
  for (const [key, value] of Object.entries(values)) {
    const field = known.get(key);
    if (!field) {
      throw new Error(`UNKNOWN_CUSTOM_FIELD:${key}`);
    }
    if (value == null || value === "") {
      if (field.isRequired) throw new Error(`REQUIRED_CUSTOM_FIELD:${key}`);
      sanitized[key] = null;
      continue;
    }
    if (field.fieldType === "number") {
      const numberValue = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numberValue)) throw new Error(`INVALID_CUSTOM_FIELD_NUMBER:${key}`);
      sanitized[key] = numberValue;
      continue;
    }
    if (field.fieldType === "select") {
      const stringValue = String(value);
      if (!fieldOptions(field.options).includes(stringValue)) throw new Error(`INVALID_CUSTOM_FIELD_OPTION:${key}`);
      sanitized[key] = stringValue;
      continue;
    }
    sanitized[key] = String(value);
  }
  for (const field of fields) {
    if (field.isRequired && (sanitized[field.systemName] == null || sanitized[field.systemName] === "")) {
      throw new Error(`REQUIRED_CUSTOM_FIELD:${field.systemName}`);
    }
  }
  return sanitized;
}

function customFieldErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  const [code, field] = error.message.split(":");
  if (!field) return null;
  const messages: Record<string, string> = {
    UNKNOWN_CUSTOM_FIELD: `unknown custom field ${field}`,
    REQUIRED_CUSTOM_FIELD: `custom field ${field} is required`,
    INVALID_CUSTOM_FIELD_NUMBER: `custom field ${field} must be a number`,
    INVALID_CUSTOM_FIELD_OPTION: `custom field ${field} has an invalid option`
  };
  if (!messages[code]) return null;
  return { code, message: messages[code], field };
}

export async function registerCasesRoutes(
  app: FastifyInstance,
  deps: { casesService: CasesService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects/:projectId/cases", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rawQuery = (req.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = paginationQuerySchema.parse(rawQuery);
    const query = listCasesQuerySchema.parse({
      projectId,
      suiteId: rawQuery.suiteId,
      sectionId: rawQuery.sectionId,
      q: rawQuery.q
    });
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases(query), page, pageSize)));
  });

  app.get("/api/sections/:sectionId/cases", async (req, reply) => {
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases({ sectionId }), page, pageSize)));
  });

  app.post("/api/sections/:sectionId/cases", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createCaseSchema.parse({
      sectionId,
      title: raw.title,
      priority: raw.priority,
      caseType: raw.caseType,
      preconditions: raw.preconditions,
      customValues: raw.customValues
    });
    try {
      const customValues = await validateCaseCustomValues(
        deps.prisma,
        deps.prisma ? await projectIdForSection(deps.prisma, sectionId) : null,
        asCustomValues(body.customValues)
      );
      return reply.send(toJsonSafe(ok(await deps.casesService.createCase({ ...body, customValues }))));
    } catch (e) {
      const customFieldError = customFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
  });

  app.get("/api/cases/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(await deps.casesService.getCase(caseId))));
  });

  app.get("/api/cases/:caseId/versions", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const rows = await deps.casesService.listCaseVersions(caseId);
    return reply.send(toJsonSafe(paged(rows, page, pageSize)));
  });

  app.patch("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = updateCaseSchema.parse(req.body);
    const ifMatchVersion = parseIfMatchVersion(req.headers["if-match"]);
    const customValues = await validateCaseCustomValues(
      deps.prisma,
      deps.prisma ? await projectIdForCase(deps.prisma, caseId) : null,
      asCustomValues(body.customValues)
    ).catch((e) => {
      const customFieldError = customFieldErrorResponse(e);
      if (customFieldError) return customFieldError;
      throw e;
    });
    if (customValues && "code" in customValues) return reply.code(400).send(customValues);
    return reply.send(
      toJsonSafe(
        ok(
          await deps.casesService.updateCase(caseId, {
            ...body,
            customValues,
            expectedVersion: body.expectedVersion ?? ifMatchVersion
          })
        )
      )
    );
  });

  app.delete("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    await deps.casesService.deleteCase(caseId);
    return reply.status(204).send();
  });

  app.post("/api/cases/:caseId/steps", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = createCaseStepSchema.parse(req.body ?? {});
    return reply.send(toJsonSafe(ok(await deps.casesService.createCaseStep(caseId, body))));
  });

  app.patch("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    const body = updateCaseStepSchema.parse(req.body ?? {});
    return reply.send(toJsonSafe(ok(await deps.casesService.updateCaseStep(stepId, body))));
  });

  app.delete("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    await deps.casesService.deleteCaseStep(stepId);
    return reply.status(204).send();
  });
}
