import { AppError } from "../../common/errors/appError.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { customFields as inMemoryCustomFields } from "../settings/settings.shared.js";

type ScalarCustomValue = string | number | boolean | null;
type CustomValues = Record<string, ScalarCustomValue>;

function fieldOptions(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export class CasesService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listCases(params: {
    projectId?: bigint;
    suiteId?: bigint;
    sectionId?: bigint;
    q?: string;
    priority?: string;
    caseType?: string;
    automation?: "manual" | "automated";
    refs?: "with" | "without";
    labels?: "with" | "without";
    estimate?: "with" | "without";
    state?: "active" | "archived" | "all";
  }) {
    return this.repo.listCases(params);
  }

  async createCase(input: {
    sectionId: bigint;
    title: string;
    priority?: string;
    caseType?: string;
    preconditions?: string;
    customValues?: Record<string, string | number | boolean | null>;
  }) {
    const created = await this.repo.createCase(input);
    await this.repo.createCaseVersionSnapshot(created.id, "case_created");
    return created;
  }
  async getCase(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const steps = await this.repo.listCaseSteps(caseId);
    return { ...found, steps };
  }
  async listCaseVersions(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return this.repo.listCaseVersions(caseId);
  }

  async getCaseVersion(caseId: bigint, versionId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const version = await this.repo.getCaseVersion(caseId, versionId);
    if (!version) throw new AppError("NOT_FOUND", `case version ${versionId.toString()} not found`, 404);
    return version;
  }

  async restoreCaseVersion(caseId: bigint, versionId: bigint, expectedVersion?: number) {
    const version = await this.getCaseVersion(caseId, versionId);
    const updated = await this.repo.updateCase(
      caseId,
      {
        title: version.title,
        priority: version.priority,
        caseType: version.caseType,
        preconditions: version.preconditions,
        customValues: version.customValuesSnapshot ?? {}
      },
      expectedVersion
    );
    if (updated === "conflict") {
      throw new AppError("CONFLICT", "case has been modified by another user", 409);
    }
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);

    const currentSteps = await this.repo.listCaseSteps(caseId);
    for (const step of currentSteps) {
      await this.repo.deleteCaseStep(step.id);
    }
    for (const step of version.stepsSnapshot.sort((a, b) => a.stepOrder - b.stepOrder)) {
      await this.repo.createCaseStep({
        caseId,
        stepOrder: step.stepOrder,
        content: step.content,
        expectedResult: step.expectedResult ?? null
      });
    }
    await this.repo.createCaseVersionSnapshot(caseId, `case_version_restored:${version.versionNo}`);
    return this.getCase(caseId);
  }
  async updateCase(
    caseId: bigint,
    patch: {
      title?: string;
      priority?: string;
      caseType?: string;
      preconditions?: string | null;
      customValues?: Record<string, string | number | boolean | null>;
      expectedUpdatedAt?: string;
      expectedVersion?: number;
    }
  ) {
    const { expectedUpdatedAt: _legacy, expectedVersion, ...nextPatch } = patch;
    const updated = await this.repo.updateCase(caseId, nextPatch, expectedVersion);
    if (updated === "conflict") {
      throw new AppError("CONFLICT", "case has been modified by another user", 409);
    }
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    await this.repo.createCaseVersionSnapshot(caseId, "case_updated");
    return updated;
  }

  async deleteCase(caseId: bigint) {
    const deleted = await this.repo.deleteCase(caseId);
    if (!deleted) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
  }

  async bulkDeleteCases(caseIds: bigint[]) {
    const uniqueCaseIds = Array.from(new Set(caseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const items = [];

    for (const caseId of uniqueCaseIds) {
      const deleted = await this.repo.deleteCase(caseId);
      items.push({
        caseId,
        success: deleted,
        error: deleted ? null : "NOT_FOUND"
      });
    }

    return {
      requested: caseIds.length,
      deleted: items.filter((item) => item.success).length,
      failed: items.filter((item) => !item.success).length,
      items
    };
  }

  async bulkMoveCases(caseIds: bigint[], targetSectionId: bigint) {
    const uniqueCaseIds = Array.from(new Set(caseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const items = [];

    for (const caseId of uniqueCaseIds) {
      const moved = await this.repo.moveCase(caseId, targetSectionId);
      items.push({
        caseId,
        success: moved != null,
        error: moved ? null : "NOT_FOUND"
      });
    }

    return {
      requested: caseIds.length,
      moved: items.filter((item) => item.success).length,
      failed: items.filter((item) => !item.success).length,
      items
    };
  }

  async bulkUpdateCases(
    caseIds: bigint[],
    patch: {
      priority?: string;
      caseType?: string;
    }
  ) {
    const uniqueCaseIds = Array.from(new Set(caseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const items = [];

    for (const caseId of uniqueCaseIds) {
      const updated = await this.repo.updateCase(caseId, patch);
      items.push({
        caseId,
        success: updated !== null && updated !== "conflict",
        error: updated === "conflict" ? "CONFLICT" : updated ? null : "NOT_FOUND"
      });
      if (updated && updated !== "conflict") {
        await this.repo.createCaseVersionSnapshot(caseId, "case_bulk_updated");
      }
    }

    return {
      requested: caseIds.length,
      updated: items.filter((item) => item.success).length,
      failed: items.filter((item) => !item.success).length,
      items
    };
  }

  async bulkArchiveCases(caseIds: bigint[], archived: boolean) {
    const uniqueCaseIds = Array.from(new Set(caseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const items = [];

    for (const caseId of uniqueCaseIds) {
      const updated = await this.repo.setCaseArchived(caseId, archived);
      items.push({
        caseId,
        success: updated !== null && updated !== "already_archived" && updated !== "already_active",
        error:
          updated === "already_archived"
            ? "ALREADY_ARCHIVED"
            : updated === "already_active"
              ? "ALREADY_ACTIVE"
              : updated
                ? null
                : "NOT_FOUND"
      });
    }

    return {
      requested: caseIds.length,
      changed: items.filter((item) => item.success).length,
      failed: items.filter((item) => !item.success).length,
      archived,
      items
    };
  }

  async resolveProjectScopedCaseIds(projectId: bigint, caseIds: bigint[]) {
    const projectCases = await this.listCases({ projectId, state: "all" });
    const projectCaseIds = new Set(projectCases.map((row) => row.id.toString()));
    return {
      scopedIds: caseIds.filter((caseId) => projectCaseIds.has(caseId.toString())),
      outOfScope: caseIds.filter((caseId) => !projectCaseIds.has(caseId.toString()))
    };
  }

  async assertProjectScopedSection(projectId: bigint, sectionId: bigint) {
    const section = await this.repo.getSection(sectionId);
    if (!section) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
    const suite = await this.repo.getSuite(section.suiteId);
    if (!suite || suite.projectId !== projectId) {
      throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found in project`, 404);
    }
    return section;
  }

  async projectIdForSection(prisma: PrismaClient | undefined, sectionId: bigint) {
    if (!prisma) {
      const section = await this.repo.getSection(sectionId);
      if (!section) return null;
      const suite = await this.repo.getSuite(section.suiteId);
      return suite?.projectId ?? null;
    }
    const row = await prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      select: { suite: { select: { projectId: true } } }
    });
    return row?.suite.projectId ?? null;
  }

  async projectIdForCase(prisma: PrismaClient | undefined, caseId: bigint) {
    if (!prisma) {
      const row = await this.repo.getCase(caseId);
      return row?.projectId ?? null;
    }
    const row = await prisma.testCase.findFirst({
      where: { id: caseId, deletedAt: null },
      select: { projectId: true }
    });
    return row?.projectId ?? null;
  }

  async validateCaseCustomValues(prisma: PrismaClient | undefined, projectId: bigint | null, values: CustomValues | undefined) {
    if (!projectId || values === undefined) return values;
    const fields = prisma
      ? await prisma.customField.findMany({
          where: { projectId, scope: "case", deletedAt: null, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
        })
      : inMemoryCustomFields
          .filter((field) => field.projectId === projectId && field.scope === "case" && field.isActive)
          .sort((left, right) => left.displayOrder - right.displayOrder || Number(left.id - right.id));
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

  customFieldErrorResponse(error: unknown) {
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

  async createCaseStep(caseId: bigint, input: { content: string; expectedResult?: string | null }) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const steps = await this.repo.listCaseSteps(caseId);
    const nextOrder = steps.reduce((m, s) => Math.max(m, s.stepOrder), 0) + 1;
    const created = await this.repo.createCaseStep({
      caseId,
      stepOrder: nextOrder,
      content: input.content,
      expectedResult: input.expectedResult
    });
    await this.repo.createCaseVersionSnapshot(caseId, "case_step_created");
    return created;
  }

  async updateCaseStep(
    stepId: bigint,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ) {
    const allCases = await this.repo.listCases({ state: "all" });
    let parentCaseId: bigint | null = null;
    for (const c of allCases) {
      const steps = await this.repo.listCaseSteps(c.id);
      if (steps.some((s) => s.id === stepId)) {
        parentCaseId = c.id;
        break;
      }
    }
    const updated = await this.repo.updateCaseStep(stepId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case step ${stepId.toString()} not found`, 404);
    if (parentCaseId) {
      await this.repo.createCaseVersionSnapshot(parentCaseId, "case_step_updated");
    }
    return updated;
  }

  async deleteCaseStep(stepId: bigint) {
    const allCases = await this.repo.listCases({ state: "all" });
    let parentCaseId: bigint | null = null;
    for (const c of allCases) {
      const steps = await this.repo.listCaseSteps(c.id);
      if (steps.some((s) => s.id === stepId)) {
        parentCaseId = c.id;
        break;
      }
    }
    const deleted = await this.repo.deleteCaseStep(stepId);
    if (!deleted) throw new AppError("NOT_FOUND", `case step ${stepId.toString()} not found`, 404);
    if (parentCaseId) {
      await this.repo.createCaseVersionSnapshot(parentCaseId, "case_step_deleted");
    }
  }
}
