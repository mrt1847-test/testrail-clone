import { describe, it, expect } from "vitest";

import { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";
import { SectionsService } from "./sections.service.js";

async function seedSections() {
  const repo = new ProjectsMemoryRepository();
  const service = new SectionsService(repo);
  const project = await repo.createProject({ name: "Demo", description: null });
  const suite = await repo.createSuite({ projectId: project.id, name: "Suite", description: null });
  return { repo, service, project, suite };
}

describe("sections service", () => {
  it("appends sections within each sibling group and lists by display order", async () => {
    const { repo, service, suite } = await seedSections();
    const parent = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Parent" });
    const firstChild = await service.createSection({ suiteId: suite.id, parentSectionId: parent.id, name: "First child" });
    const secondChild = await service.createSection({ suiteId: suite.id, parentSectionId: parent.id, name: "Second child" });
    const root = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Root sibling" });

    const sections = await repo.listSectionsBySuite(suite.id);
    const roots = sections.filter((section) => section.parentSectionId == null);
    const children = sections.filter((section) => section.parentSectionId === parent.id);
    expect(roots.map((section) => [section.id, section.displayOrder])).toEqual([
      [parent.id, 0],
      [root.id, 1]
    ]);
    expect(children.map((section) => [section.id, section.displayOrder])).toEqual([
      [firstChild.id, 0],
      [secondChild.id, 1]
    ]);
  });

  it("reorders sections inside one sibling group and keeps omitted siblings after the explicit order", async () => {
    const { repo, service, suite } = await seedSections();
    const first = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "First" });
    const second = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Second" });
    const third = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Third" });

    const result = await service.reorderSectionsInParent(suite.id, null, [second.id, first.id]);

    expect(result.updated).toBe(3);
    expect(result.orderedSectionIds).toEqual([second.id, first.id, third.id]);
    const roots = (await repo.listSectionsBySuite(suite.id)).filter((section) => section.parentSectionId == null);
    expect(roots.map((section) => section.id)).toEqual([second.id, first.id, third.id]);
    expect(roots.map((section) => section.displayOrder)).toEqual([0, 1, 2]);
  });

  it("appends a section when moving it to a different parent", async () => {
    const { repo, service, suite } = await seedSections();
    const source = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Source" });
    const targetParent = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Target parent" });
    const existingChild = await service.createSection({
      suiteId: suite.id,
      parentSectionId: targetParent.id,
      name: "Existing child"
    });

    const moved = await service.updateSection(source.id, { parentSectionId: targetParent.id });

    expect(moved.parentSectionId).toBe(targetParent.id);
    expect(moved.displayOrder).toBe(1);
    const children = (await repo.listSectionsBySuite(suite.id)).filter((section) => section.parentSectionId === targetParent.id);
    expect(children.map((section) => section.id)).toEqual([existingChild.id, source.id]);
  });

  it("rejects self-parenting, descendant cycles, and cross-suite parents", async () => {
    const { repo, service, project, suite } = await seedSections();
    const otherSuite = await repo.createSuite({ projectId: project.id, name: "Other suite", description: null });
    const parent = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Parent" });
    const child = await service.createSection({ suiteId: suite.id, parentSectionId: parent.id, name: "Child" });
    const otherSuiteSection = await service.createSection({
      suiteId: otherSuite.id,
      parentSectionId: null,
      name: "Other suite section"
    });

    await expect(service.updateSection(parent.id, { parentSectionId: parent.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
    await expect(service.updateSection(parent.id, { parentSectionId: child.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
    await expect(service.updateSection(parent.id, { parentSectionId: otherSuiteSection.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });

  it("copies a full section subtree with contained cases, steps, and ID mappings", async () => {
    const { repo, service, project, suite } = await seedSections();
    const source = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Checkout" });
    const child = await service.createSection({ suiteId: suite.id, parentSectionId: source.id, name: "Guest checkout" });
    const targetParent = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Copied area" });
    const sourceCase = await repo.createCase({
      projectId: project.id,
      sectionId: child.id,
      title: "Guest can pay",
      priority: "high",
      caseType: "regression",
      labels: ["payments"],
      automationKey: "AUTO-1",
      externalId: "EXT-1",
      customValues: { risk: "high" }
    });
    await repo.createCaseStep({ caseId: sourceCase.id, stepOrder: 1, content: "Open checkout", expectedResult: "Checkout opens" });

    const result = await service.copySectionSubtree(source.id, { targetParentSectionId: targetParent.id });

    expect(result.sectionIdMap).toHaveLength(2);
    expect(result.caseIdMap).toHaveLength(1);
    const copiedRoot = await repo.getSection(result.copiedSectionId);
    expect(copiedRoot?.parentSectionId).toBe(targetParent.id);
    expect(copiedRoot?.name).toBe(source.name);

    const copiedChildId = result.sectionIdMap.find((item) => item.sourceSectionId === child.id)?.copiedSectionId;
    expect(copiedChildId).toBeDefined();
    const copiedCases = await repo.listCases({ sectionId: copiedChildId!, sectionScope: "direct", state: "all" });
    expect(copiedCases).toHaveLength(1);
    expect(copiedCases[0]!.title).toBe(sourceCase.title);
    expect(copiedCases[0]!.labels).toEqual(["payments"]);
    expect(copiedCases[0]!.automationKey).toBeNull();
    expect(copiedCases[0]!.externalId).toBeNull();
    expect(copiedCases[0]!.customValues).toEqual({ risk: "high" });
    const copiedSteps = await repo.listCaseSteps(copiedCases[0]!.id);
    expect(copiedSteps).toEqual([{ id: copiedSteps[0]!.id, stepOrder: 1, content: "Open checkout", expectedResult: "Checkout opens" }]);
  });

  it("rejects copying a section under itself or one of its descendants", async () => {
    const { service, suite } = await seedSections();
    const source = await service.createSection({ suiteId: suite.id, parentSectionId: null, name: "Source" });
    const child = await service.createSection({ suiteId: suite.id, parentSectionId: source.id, name: "Child" });

    await expect(service.copySectionSubtree(source.id, { targetParentSectionId: source.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
    await expect(service.copySectionSubtree(source.id, { targetParentSectionId: child.id })).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });
});
