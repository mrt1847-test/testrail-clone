import { AppError } from "../../common/errors/appError.js";
import { createSignedDownloadTarget } from "../../domain/attachmentStorage.js";
import {
  findCaseVersionAttachmentSnapshot,
  parseCaseVersionAttachmentSnapshots
} from "./caseVersionAttachmentSnapshot.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { caseRefsValidationError, prepareCaseRefsInput } from "../../domain/caseRefs.js";
import { caseRowWithAiCaseFields, normalizeAiCaseFields } from "../../domain/aiEvaluationFields.js";
import { normalizeCaseLabels } from "../../domain/caseLabels.js";
import { caseRowWithExploratoryFields, normalizeExploratoryCaseFields } from "../../domain/exploratoryCaseFields.js";
import {
  fieldOptions as parseFieldOptions,
  mapValidationErrorToResponse,
  sanitizeCustomFieldMap,
  type CustomFieldValue
} from "../../domain/customFieldTypes.js";
import {
  assertWritableCustomValueKeys,
  fieldsVisibleForEdit,
  filterCustomValuesForRead,
  type CustomFieldVisibilityContext
} from "../../domain/customFieldVisibility.js";
import { loadActiveCustomFields } from "../settings/customFieldAccess.js";
import { customFields as inMemoryCustomFields } from "../settings/settings.shared.js";

type ScalarCustomValue = CustomFieldValue;
type CustomValues = Record<string, ScalarCustomValue>;

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
    sectionScope?: "direct" | "subtree";
    state?: "active" | "archived" | "all";
  }) {
    return this.repo.listCases(params);
  }

  async createCase(input: {
    sectionId: bigint;
    title: string;
    priority?: string;
    caseType?: string;
    estimate?: string | null;
    preconditions?: string;
    expectedResult?: string | null;
    mission?: string | null;
    goals?: string | null;
    aiInput?: string | null;
    aiExpectedOutput?: string | null;
    caseTemplateId?: bigint | null;
    refs?: string | null;
    labels?: string[];
    customValues?: Record<string, CustomFieldValue>;
  }) {
    const exploratory = normalizeExploratoryCaseFields({
      mission: input.mission,
      goals: input.goals,
      customValues: input.customValues
    });
    const ai = normalizeAiCaseFields({
      aiInput: input.aiInput,
      aiExpectedOutput: input.aiExpectedOutput,
      customValues: exploratory.customValues
    });
    let refs = input.refs;
    if (refs !== undefined) {
      try {
        refs = prepareCaseRefsInput(refs);
      } catch (e) {
        const mapped = caseRefsValidationError(e);
        if (mapped) throw mapped;
        throw e;
      }
    }
    const created = await this.repo.createCase({
      ...input,
      ...exploratory,
      ...ai,
      refs
    });
    await this.repo.createCaseVersionSnapshot(created.id, "case_created");
    return caseRowWithAiCaseFields(caseRowWithExploratoryFields(created));
  }
  async getCase(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const [steps, scenarios] = await Promise.all([
      this.repo.listCaseSteps(caseId),
      this.repo.listCaseScenarios(caseId)
    ]);
    return { ...caseRowWithAiCaseFields(caseRowWithExploratoryFields(found)), steps, scenarios };
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

  async getCaseVersionAttachmentDownload(caseId: bigint, versionNo: number, attachmentId: string) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const version = await this.repo.getCaseVersionByVersionNo(caseId, versionNo);
    if (!version) {
      throw new AppError("NOT_FOUND", `case version ${versionNo} not found`, 404);
    }
    const snapshots = parseCaseVersionAttachmentSnapshots(version.attachmentSnapshots);
    const snapshot = findCaseVersionAttachmentSnapshot(snapshots, attachmentId);
    if (!snapshot) {
      throw new AppError("NOT_FOUND", "attachment not found in version snapshot", 404);
    }
    const signed = createSignedDownloadTarget(snapshot.storageKey);
    return {
      attachmentId: snapshot.attachmentId,
      fileName: snapshot.fileName,
      contentType: snapshot.contentType ?? null,
      downloadUrl: signed.downloadUrl,
      expiresAt: signed.expiresAt
    };
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
      estimate?: string | null;
      preconditions?: string | null;
      expectedResult?: string | null;
      mission?: string | null;
      goals?: string | null;
      aiInput?: string | null;
      aiExpectedOutput?: string | null;
      caseTemplateId?: bigint | null;
      refs?: string | null;
      labels?: string[];
      customValues?: Record<string, CustomFieldValue>;
      expectedUpdatedAt?: string;
      expectedVersion?: number;
    }
  ) {
    const { expectedUpdatedAt: _legacy, expectedVersion, refs: rawRefs, labels: rawLabels, ...rest } = patch;
    const exploratory = normalizeExploratoryCaseFields({
      mission: rest.mission,
      goals: rest.goals,
      customValues: rest.customValues
    });
    const ai = normalizeAiCaseFields({
      aiInput: rest.aiInput,
      aiExpectedOutput: rest.aiExpectedOutput,
      customValues: exploratory.customValues
    });
    let refs = rawRefs;
    if (refs !== undefined) {
      try {
        refs = prepareCaseRefsInput(refs);
      } catch (e) {
        const mapped = caseRefsValidationError(e);
        if (mapped) throw mapped;
        throw e;
      }
    }
    const labels = rawLabels !== undefined ? normalizeCaseLabels(rawLabels) : undefined;
    const nextPatch = {
      ...rest,
      ...(rest.mission !== undefined ||
      rest.goals !== undefined ||
      rest.aiInput !== undefined ||
      rest.aiExpectedOutput !== undefined ||
      rest.customValues !== undefined
        ? { ...exploratory, ...ai }
        : {}),
      ...(refs !== undefined ? { refs } : {}),
      ...(labels !== undefined ? { labels } : {})
    };
    const updated = await this.repo.updateCase(caseId, nextPatch, expectedVersion);
    if (updated === "conflict") {
      throw new AppError("CONFLICT", "case has been modified by another user", 409);
    }
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    await this.repo.createCaseVersionSnapshot(caseId, "case_updated");
    return caseRowWithAiCaseFields(caseRowWithExploratoryFields(updated));
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

  async bulkCopyCases(caseIds: bigint[], targetSectionId: bigint) {
    const uniqueCaseIds = Array.from(new Set(caseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const items = [];

    for (const sourceCaseId of uniqueCaseIds) {
      const source = await this.repo.getCase(sourceCaseId);
      if (!source) {
        items.push({ sourceCaseId, copiedCaseId: null, success: false, error: "NOT_FOUND" });
        continue;
      }

      const copied = await this.repo.createCase({
        projectId: source.projectId,
        sectionId: targetSectionId,
        title: source.title,
        priority: source.priority,
        caseType: source.caseType,
        estimate: source.estimate,
        refs: source.refs,
        labels: [...(source.labels ?? [])],
        automationKey: null,
        externalId: null,
        preconditions: source.preconditions,
        expectedResult: source.expectedResult ?? null,
        caseTemplateId: source.caseTemplateId ?? null,
        customValues: { ...(source.customValues ?? {}) },
        archivedAt: null
      });

      const steps = await this.repo.listCaseSteps(sourceCaseId);
      for (const step of steps) {
        await this.repo.createCaseStep({
          caseId: copied.id,
          stepOrder: step.stepOrder,
          content: step.content,
          expectedResult: step.expectedResult ?? null
        });
      }
      const scenarios = await this.repo.listCaseScenarios(sourceCaseId);
      for (const scenario of scenarios) {
        await this.repo.createCaseScenario({
          caseId: copied.id,
          scenarioOrder: scenario.scenarioOrder,
          name: scenario.name,
          content: scenario.content
        });
      }
      await this.repo.createCaseVersionSnapshot(copied.id, `case_copied:${sourceCaseId.toString()}`);

      items.push({ sourceCaseId, copiedCaseId: copied.id, success: true, error: null });
    }

    return {
      requested: caseIds.length,
      copied: items.filter((item) => item.success).length,
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

  async reorderCasesInSection(projectId: bigint, sectionId: bigint, orderedCaseIds: bigint[]) {
    await this.assertProjectScopedSection(projectId, sectionId);
    const uniqueOrderedIds = Array.from(new Set(orderedCaseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const sectionCases = await this.listCases({ sectionId, sectionScope: "direct", state: "all" });
    const casesById = new Map(sectionCases.map((row) => [row.id.toString(), row]));
    const missing = uniqueOrderedIds.filter((caseId) => !casesById.has(caseId.toString()));
    if (missing.length > 0) {
      throw new AppError("VALIDATION_ERROR", "orderedCaseIds must all belong to the target section", 400);
    }

    const orderedIdSet = new Set(uniqueOrderedIds.map((caseId) => caseId.toString()));
    const nextOrder = [
      ...uniqueOrderedIds,
      ...sectionCases.filter((row) => !orderedIdSet.has(row.id.toString())).map((row) => row.id)
    ];

    for (let index = 0; index < nextOrder.length; index += 1) {
      await this.repo.updateCase(nextOrder[index]!, { displayOrder: index });
    }

    return {
      sectionId,
      orderedCaseIds: nextOrder,
      updated: nextOrder.length
    };
  }

  async positionCasesInSection(
    projectId: bigint,
    input: { sectionId: bigint; caseIds: bigint[]; beforeCaseId?: bigint; afterCaseId?: bigint }
  ) {
    await this.assertProjectScopedSection(projectId, input.sectionId);
    if (input.beforeCaseId && input.afterCaseId) {
      throw new AppError("VALIDATION_ERROR", "provide only one of beforeCaseId or afterCaseId", 400);
    }

    const uniqueMovingIds = Array.from(new Set(input.caseIds.map((caseId) => caseId.toString()))).map((caseId) => BigInt(caseId));
    const sectionCases = await this.listCases({ sectionId: input.sectionId, sectionScope: "direct", state: "all" });
    const casesById = new Map(sectionCases.map((row) => [row.id.toString(), row]));
    const missing = [
      ...uniqueMovingIds,
      ...(input.beforeCaseId ? [input.beforeCaseId] : []),
      ...(input.afterCaseId ? [input.afterCaseId] : [])
    ].filter((caseId) => !casesById.has(caseId.toString()));
    if (missing.length > 0) {
      throw new AppError("VALIDATION_ERROR", "caseIds and anchors must all belong to the target section", 400);
    }

    const movingIdSet = new Set(uniqueMovingIds.map((caseId) => caseId.toString()));
    if (
      (input.beforeCaseId && movingIdSet.has(input.beforeCaseId.toString())) ||
      (input.afterCaseId && movingIdSet.has(input.afterCaseId.toString()))
    ) {
      throw new AppError("VALIDATION_ERROR", "anchor case must not be one of the moved cases", 400);
    }

    const remaining = sectionCases.filter((row) => !movingIdSet.has(row.id.toString())).map((row) => row.id);
    let insertIndex = remaining.length;
    if (input.beforeCaseId) {
      insertIndex = remaining.findIndex((caseId) => caseId === input.beforeCaseId);
    } else if (input.afterCaseId) {
      const afterIndex = remaining.findIndex((caseId) => caseId === input.afterCaseId);
      insertIndex = afterIndex === -1 ? remaining.length : afterIndex + 1;
    }
    if (insertIndex < 0) insertIndex = remaining.length;

    const nextOrder = [
      ...remaining.slice(0, insertIndex),
      ...uniqueMovingIds,
      ...remaining.slice(insertIndex)
    ];
    for (let index = 0; index < nextOrder.length; index += 1) {
      await this.repo.updateCase(nextOrder[index]!, { displayOrder: index });
    }

    return {
      sectionId: input.sectionId,
      movedCaseIds: uniqueMovingIds,
      orderedCaseIds: nextOrder,
      updated: nextOrder.length
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

  async validateCaseCustomValues(
    prisma: PrismaClient | undefined,
    projectId: bigint | null,
    values: CustomValues | undefined,
    visibility?: CustomFieldVisibilityContext
  ) {
    if (!projectId || values === undefined) return values;
    const loaded = prisma
      ? await loadActiveCustomFields(prisma, projectId, "case")
      : inMemoryCustomFields
          .filter((field) => field.projectId === projectId && field.scope === "case" && field.isActive)
          .sort((left, right) => left.displayOrder - right.displayOrder || Number(left.id - right.id))
          .map((field) => ({
            id: field.id,
            name: field.name,
            systemName: field.systemName,
            fieldType: field.fieldType,
            scope: field.scope,
            options: field.options,
            isRequired: field.isRequired,
            isActive: field.isActive,
            displayOrder: field.displayOrder,
            visibility: field.visibility ?? {}
          }));
    if (visibility) {
      assertWritableCustomValueKeys(values as Record<string, unknown>, loaded, visibility);
    }
    const editable = visibility ? fieldsVisibleForEdit(loaded, visibility) : loaded;
    return sanitizeCustomFieldMap(
      editable.map((field) => ({
        systemName: field.systemName,
        fieldType: field.fieldType,
        options: parseFieldOptions(field.options),
        isRequired: field.isRequired
      })),
      values as Record<string, unknown>,
      "case"
    ) as CustomValues;
  }

  filterCaseCustomValuesForRead<T extends { customValues?: CustomValues; caseTemplateId?: bigint | null }>(
    row: T,
    visibility: CustomFieldVisibilityContext,
    fields: Awaited<ReturnType<typeof loadActiveCustomFields>>
  ): T {
    if (!row.customValues) return row;
    return {
      ...row,
      customValues: filterCustomValuesForRead(row.customValues, fields, visibility)
    };
  }

  async mergeCaseCustomValuesForWrite(
    prisma: PrismaClient | undefined,
    projectId: bigint,
    existingValues: CustomValues | undefined,
    incoming: CustomValues | undefined,
    visibility: CustomFieldVisibilityContext
  ) {
    if (incoming === undefined) return undefined;
    const merged = { ...(existingValues ?? {}), ...incoming };
    return this.validateCaseCustomValues(prisma, projectId, merged, visibility);
  }

  customFieldErrorResponse(error: unknown) {
    return mapValidationErrorToResponse(error);
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

  async listCaseScenarios(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return this.repo.listCaseScenarios(caseId);
  }

  async createCaseScenario(caseId: bigint, input: { name: string; content: string }) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const scenarios = await this.repo.listCaseScenarios(caseId);
    const nextOrder = scenarios.reduce((max, row) => Math.max(max, row.scenarioOrder), 0) + 1;
    const created = await this.repo.createCaseScenario({
      caseId,
      scenarioOrder: nextOrder,
      name: input.name,
      content: input.content
    });
    await this.repo.createCaseVersionSnapshot(caseId, "case_scenario_created");
    return created;
  }

  async updateCaseScenario(
    scenarioId: bigint,
    patch: { name?: string; content?: string; scenarioOrder?: number }
  ) {
    const parentCaseId = await this.findCaseIdForScenario(scenarioId);
    const updated = await this.repo.updateCaseScenario(scenarioId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case scenario ${scenarioId.toString()} not found`, 404);
    if (parentCaseId) await this.repo.createCaseVersionSnapshot(parentCaseId, "case_scenario_updated");
    return updated;
  }

  async deleteCaseScenario(scenarioId: bigint) {
    const parentCaseId = await this.findCaseIdForScenario(scenarioId);
    const deleted = await this.repo.deleteCaseScenario(scenarioId);
    if (!deleted) throw new AppError("NOT_FOUND", `case scenario ${scenarioId.toString()} not found`, 404);
    if (parentCaseId) await this.repo.createCaseVersionSnapshot(parentCaseId, "case_scenario_deleted");
  }

  async replaceCaseScenarios(caseId: bigint, scenarios: Array<{ name: string; content: string }>) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const replaced = await this.repo.replaceCaseScenarios(caseId, scenarios);
    await this.repo.createCaseVersionSnapshot(caseId, "case_scenarios_replaced");
    return replaced;
  }

  private async findCaseIdForScenario(scenarioId: bigint) {
    const allCases = await this.repo.listCases({ state: "all" });
    for (const testCase of allCases) {
      const scenarios = await this.repo.listCaseScenarios(testCase.id);
      if (scenarios.some((row) => row.id === scenarioId)) return testCase.id;
    }
    return null;
  }
}
