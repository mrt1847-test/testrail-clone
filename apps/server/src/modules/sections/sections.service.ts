import { AppError } from "../../common/errors/appError.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

export class SectionsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listSections(suiteId: bigint) {
    return this.repo.listSectionsBySuite(suiteId);
  }

  async createSection(input: { suiteId: bigint; parentSectionId?: bigint | null; name: string }) {
    if (input.parentSectionId != null) {
      const parent = await this.repo.getSection(input.parentSectionId);
      if (!parent || parent.suiteId !== input.suiteId) {
        throw new AppError("VALIDATION_ERROR", "parent section must belong to the same suite", 400);
      }
    }
    return this.repo.createSection(input);
  }

  async updateSection(sectionId: bigint, patch: { parentSectionId?: bigint | null; name?: string }) {
    const current = await this.repo.getSection(sectionId);
    if (!current) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);

    if (patch.parentSectionId !== undefined) {
      await this.assertValidParentChange(current, patch.parentSectionId);
      const sameParent = (current.parentSectionId ?? null) === (patch.parentSectionId ?? null);
      if (!sameParent) {
        const siblings = await this.listSiblingSections(current.suiteId, patch.parentSectionId ?? null);
        const nextOrder = siblings.reduce((max, row) => Math.max(max, row.displayOrder ?? 0), -1) + 1;
        const updated = await this.repo.updateSection(sectionId, { ...patch, displayOrder: nextOrder });
        if (!updated) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
        return updated;
      }
    }

    const updated = await this.repo.updateSection(sectionId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
    return updated;
  }

  async reorderSectionsInParent(suiteId: bigint, parentSectionId: bigint | null, orderedSectionIds: bigint[]) {
    if (parentSectionId != null) {
      const parent = await this.repo.getSection(parentSectionId);
      if (!parent || parent.suiteId !== suiteId) {
        throw new AppError("VALIDATION_ERROR", "parent section must belong to the same suite", 400);
      }
    }

    const uniqueOrderedIds = Array.from(new Set(orderedSectionIds.map((sectionId) => sectionId.toString()))).map((sectionId) =>
      BigInt(sectionId)
    );
    const siblings = await this.listSiblingSections(suiteId, parentSectionId);
    const siblingsById = new Map(siblings.map((section) => [section.id.toString(), section]));
    const missing = uniqueOrderedIds.filter((sectionId) => !siblingsById.has(sectionId.toString()));
    if (missing.length > 0) {
      throw new AppError("VALIDATION_ERROR", "orderedSectionIds must all belong to the same sibling group", 400);
    }

    const orderedIdSet = new Set(uniqueOrderedIds.map((sectionId) => sectionId.toString()));
    const nextOrder = [
      ...uniqueOrderedIds,
      ...siblings.filter((section) => !orderedIdSet.has(section.id.toString())).map((section) => section.id)
    ];
    for (let index = 0; index < nextOrder.length; index += 1) {
      await this.repo.updateSection(nextOrder[index]!, { displayOrder: index });
    }

    return {
      suiteId,
      parentSectionId,
      orderedSectionIds: nextOrder,
      updated: nextOrder.length
    };
  }

  async copySectionSubtree(sectionId: bigint, input: { targetParentSectionId?: bigint | null }) {
    const source = await this.repo.getSection(sectionId);
    if (!source) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);

    const targetParentSectionId = input.targetParentSectionId ?? source.parentSectionId ?? null;
    if (targetParentSectionId != null) {
      const targetParent = await this.repo.getSection(targetParentSectionId);
      if (!targetParent || targetParent.suiteId !== source.suiteId) {
        throw new AppError("VALIDATION_ERROR", "target parent section must belong to the same suite", 400);
      }
    }

    const sourceSections = await this.repo.listSectionsBySuite(source.suiteId);
    const sourceSubtreeIds = this.collectSubtreeIds(sourceSections, source.id);
    if (targetParentSectionId != null && sourceSubtreeIds.has(targetParentSectionId.toString())) {
      throw new AppError("VALIDATION_ERROR", "section cannot be copied under itself or one of its descendants", 400);
    }

    const childrenByParent = new Map<string, typeof sourceSections>();
    for (const section of sourceSections) {
      if (section.parentSectionId == null) continue;
      const key = section.parentSectionId.toString();
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), section]);
    }

    const sectionIdMap: Array<{ sourceSectionId: bigint; copiedSectionId: bigint }> = [];
    const caseIdMap: Array<{ sourceCaseId: bigint; copiedCaseId: bigint }> = [];

    const copyOne = async (current: typeof source, parentSectionId: bigint | null): Promise<typeof source> => {
      const copied = await this.repo.createSection({
        suiteId: current.suiteId,
        parentSectionId,
        name: current.name
      });
      sectionIdMap.push({ sourceSectionId: current.id, copiedSectionId: copied.id });

      const cases = await this.repo.listCases({ sectionId: current.id, sectionScope: "direct", state: "all" });
      for (const sourceCase of cases) {
        const copiedCase = await this.repo.createCase({
          projectId: sourceCase.projectId,
          sectionId: copied.id,
          title: sourceCase.title,
          priority: sourceCase.priority,
          caseType: sourceCase.caseType,
          estimate: sourceCase.estimate,
          refs: sourceCase.refs,
          labels: [...(sourceCase.labels ?? [])],
          automationKey: null,
          externalId: null,
          preconditions: sourceCase.preconditions,
          customValues: { ...(sourceCase.customValues ?? {}) },
          archivedAt: null
        });
        const steps = await this.repo.listCaseSteps(sourceCase.id);
        for (const step of steps) {
          await this.repo.createCaseStep({
            caseId: copiedCase.id,
            stepOrder: step.stepOrder,
            content: step.content,
            expectedResult: step.expectedResult ?? null
          });
        }
        await this.repo.createCaseVersionSnapshot(copiedCase.id, `section_copied:${sourceCase.id.toString()}`);
        caseIdMap.push({ sourceCaseId: sourceCase.id, copiedCaseId: copiedCase.id });
      }

      for (const child of childrenByParent.get(current.id.toString()) ?? []) {
        await copyOne(child, copied.id);
      }

      return copied;
    };

    const copiedRootSection = await copyOne(source, targetParentSectionId);
    return {
      sourceSectionId: source.id,
      copiedSectionId: copiedRootSection.id,
      targetParentSectionId,
      sectionIdMap,
      caseIdMap
    };
  }

  async deleteSection(sectionId: bigint) {
    const casesInSectionTree = await this.repo.listCases({ sectionId, state: "all" });
    if (casesInSectionTree.length > 0) {
      throw new AppError(
        "SECTION_NOT_EMPTY",
        "section has test cases in this section tree; move or delete cases first",
        409
      );
    }
    const deleted = await this.repo.deleteSection(sectionId);
    if (!deleted) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
  }

  private async listSiblingSections(suiteId: bigint, parentSectionId: bigint | null) {
    const sections = await this.repo.listSectionsBySuite(suiteId);
    return sections.filter((section) => (section.parentSectionId ?? null) === parentSectionId);
  }

  private collectSubtreeIds(sections: Array<{ id: bigint; parentSectionId?: bigint | null }>, rootSectionId: bigint) {
    const out = new Set<string>([rootSectionId.toString()]);
    const childrenByParent = new Map<string, bigint[]>();
    for (const section of sections) {
      if (section.parentSectionId == null) continue;
      const key = section.parentSectionId.toString();
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), section.id]);
    }
    const stack = [...(childrenByParent.get(rootSectionId.toString()) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      out.add(next.toString());
      stack.push(...(childrenByParent.get(next.toString()) ?? []));
    }
    return out;
  }

  private async assertValidParentChange(current: { id: bigint; suiteId: bigint }, parentSectionId: bigint | null) {
    if (parentSectionId == null) return;
    if (parentSectionId === current.id) {
      throw new AppError("VALIDATION_ERROR", "section cannot be its own parent", 400);
    }

    const parent = await this.repo.getSection(parentSectionId);
    if (!parent || parent.suiteId !== current.suiteId) {
      throw new AppError("VALIDATION_ERROR", "parent section must belong to the same suite", 400);
    }

    const sections = await this.repo.listSectionsBySuite(current.suiteId);
    const childrenByParent = new Map<string, bigint[]>();
    for (const section of sections) {
      if (section.parentSectionId == null) continue;
      const key = section.parentSectionId.toString();
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), section.id]);
    }

    const stack = [...(childrenByParent.get(current.id.toString()) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (next === parentSectionId) {
        throw new AppError("VALIDATION_ERROR", "section cannot be moved under one of its descendants", 400);
      }
      stack.push(...(childrenByParent.get(next.toString()) ?? []));
    }
  }
}
