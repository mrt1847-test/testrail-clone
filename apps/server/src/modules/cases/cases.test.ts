import { describe, expect, it } from "vitest";

import { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";
import { CasesService } from "./cases.service.js";

async function seedCatalog() {
  const repo = new ProjectsMemoryRepository();
  const service = new CasesService(repo);
  const project = await repo.createProject({ name: "Demo", description: null, projectType: "single_repo" });
  const suite = (await repo.listSuitesByProject(project.id))[0]!;
  for (const section of await repo.listSectionsBySuite(suite.id)) {
    await repo.deleteSection(section.id);
  }
  const sourceSection = await repo.createSection({ suiteId: suite.id, parentSectionId: null, name: "Source" });
  const targetSection = await repo.createSection({ suiteId: suite.id, parentSectionId: null, name: "Target" });
  const firstCase = await service.createCase({
    sectionId: sourceSection.id,
    title: "Checkout happy path",
    priority: "high",
    caseType: "regression"
  });
  const secondCase = await service.createCase({
    sectionId: sourceSection.id,
    title: "Profile save",
    priority: "medium",
    caseType: "functional"
  });
  return { repo, service, project, sourceSection, targetSection, firstCase, secondCase };
}

describe("cases service", () => {
  it("moves selected cases into another section", async () => {
    const { repo, service, project, sourceSection, targetSection, firstCase, secondCase } = await seedCatalog();

    await service.assertProjectScopedSection(project.id, targetSection.id);
    const { scopedIds, outOfScope } = await service.resolveProjectScopedCaseIds(project.id, [firstCase.id, secondCase.id]);
    expect(outOfScope).toEqual([]);

    const result = await service.bulkMoveCases(scopedIds, targetSection.id);
    expect(result.moved).toBe(2);
    expect(result.failed).toBe(0);

    const sourceCases = await repo.listCases({ sectionId: sourceSection.id });
    const targetCases = await repo.listCases({ sectionId: targetSection.id });
    expect(sourceCases).toHaveLength(0);
    expect(targetCases.map((row) => row.id)).toEqual([firstCase.id, secondCase.id]);
  });

  it("appends moved cases to the target section order instead of falling back to id order", async () => {
    const { repo, service, project, targetSection, firstCase } = await seedCatalog();
    const existingTargetCase = await service.createCase({
      sectionId: targetSection.id,
      title: "Already in target",
      priority: "medium",
      caseType: "functional"
    });

    const { scopedIds } = await service.resolveProjectScopedCaseIds(project.id, [firstCase.id]);
    const result = await service.bulkMoveCases(scopedIds, targetSection.id);
    expect(result.moved).toBe(1);

    const targetCases = await repo.listCases({ sectionId: targetSection.id });
    expect(targetCases.map((row) => row.id)).toEqual([existingTargetCase.id, firstCase.id]);
    expect(targetCases.map((row) => row.displayOrder)).toEqual([0, 1]);
  });

  it("reorders cases within a section and keeps omitted cases after the explicit order", async () => {
    const { repo, service, project, sourceSection, firstCase, secondCase } = await seedCatalog();
    const thirdCase = await service.createCase({
      sectionId: sourceSection.id,
      title: "Password reset",
      priority: "low",
      caseType: "functional"
    });

    const result = await service.reorderCasesInSection(project.id, sourceSection.id, [secondCase.id, firstCase.id]);
    expect(result.updated).toBe(3);
    expect(result.orderedCaseIds).toEqual([secondCase.id, firstCase.id, thirdCase.id]);

    const sourceCases = await repo.listCases({ sectionId: sourceSection.id });
    expect(sourceCases.map((row) => row.id)).toEqual([secondCase.id, firstCase.id, thirdCase.id]);
    expect(sourceCases.map((row) => row.displayOrder)).toEqual([0, 1, 2]);
  });

  it("positions a visible subset while preserving non-visible case order", async () => {
    const { repo, service, project, sourceSection, firstCase, secondCase } = await seedCatalog();
    const thirdCase = await service.createCase({
      sectionId: sourceSection.id,
      title: "Password reset",
      priority: "low",
      caseType: "functional"
    });
    const fourthCase = await service.createCase({
      sectionId: sourceSection.id,
      title: "Invite user",
      priority: "medium",
      caseType: "functional"
    });

    const result = await service.positionCasesInSection(project.id, {
      sectionId: sourceSection.id,
      caseIds: [thirdCase.id],
      beforeCaseId: secondCase.id
    });

    expect(result.movedCaseIds).toEqual([thirdCase.id]);
    expect(result.orderedCaseIds).toEqual([firstCase.id, thirdCase.id, secondCase.id, fourthCase.id]);
    const sourceCases = await repo.listCases({ sectionId: sourceSection.id, sectionScope: "direct" });
    expect(sourceCases.map((row) => row.id)).toEqual([firstCase.id, thirdCase.id, secondCase.id, fourthCase.id]);
    expect(sourceCases.map((row) => row.displayOrder)).toEqual([0, 1, 2, 3]);
  });

  it("positions cases after an anchor and appends when no anchor is provided", async () => {
    const { repo, service, project, sourceSection, firstCase, secondCase } = await seedCatalog();
    const thirdCase = await service.createCase({
      sectionId: sourceSection.id,
      title: "Password reset",
      priority: "low",
      caseType: "functional"
    });

    await service.positionCasesInSection(project.id, {
      sectionId: sourceSection.id,
      caseIds: [firstCase.id],
      afterCaseId: thirdCase.id
    });
    await expect(repo.listCases({ sectionId: sourceSection.id, sectionScope: "direct" })).resolves.toMatchObject([
      { id: secondCase.id },
      { id: thirdCase.id },
      { id: firstCase.id }
    ]);

    await service.positionCasesInSection(project.id, {
      sectionId: sourceSection.id,
      caseIds: [secondCase.id]
    });
    await expect(repo.listCases({ sectionId: sourceSection.id, sectionScope: "direct" })).resolves.toMatchObject([
      { id: thirdCase.id },
      { id: firstCase.id },
      { id: secondCase.id }
    ]);
  });

  it("rejects reordering cases that are not in the target section", async () => {
    const { service, project, sourceSection, targetSection, firstCase } = await seedCatalog();
    const targetCase = await service.createCase({
      sectionId: targetSection.id,
      title: "Already elsewhere",
      priority: "medium",
      caseType: "functional"
    });

    await expect(
      service.reorderCasesInSection(project.id, sourceSection.id, [targetCase.id, firstCase.id])
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("distinguishes direct section case order from subtree browsing", async () => {
    const { repo, service, project, sourceSection, firstCase, secondCase } = await seedCatalog();
    const childSection = await repo.createSection({
      suiteId: sourceSection.suiteId,
      parentSectionId: sourceSection.id,
      name: "Child"
    });
    const childCase = await service.createCase({
      sectionId: childSection.id,
      title: "Child section case",
      priority: "low",
      caseType: "functional"
    });

    await expect(service.listCases({ sectionId: sourceSection.id })).resolves.toMatchObject([
      { id: firstCase.id },
      { id: secondCase.id },
      { id: childCase.id }
    ]);
    await expect(service.listCases({ sectionId: sourceSection.id, sectionScope: "direct" })).resolves.toMatchObject([
      { id: firstCase.id },
      { id: secondCase.id }
    ]);
    await expect(
      service.reorderCasesInSection(project.id, sourceSection.id, [childCase.id, firstCase.id])
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("copies selected cases with custom values and ordered steps", async () => {
    const { repo, service, project, sourceSection, targetSection, firstCase } = await seedCatalog();
    await repo.updateCase(firstCase.id, {
      preconditions: "Customer is signed in",
      customValues: { component: "checkout", risk: "high" }
    });
    await service.createCaseStep(firstCase.id, { content: "Open checkout", expectedResult: "Cart appears" });
    await service.createCaseStep(firstCase.id, { content: "Submit payment", expectedResult: "Order is placed" });

    await service.assertProjectScopedSection(project.id, targetSection.id);
    const { scopedIds, outOfScope } = await service.resolveProjectScopedCaseIds(project.id, [firstCase.id]);
    expect(outOfScope).toEqual([]);

    const result = await service.bulkCopyCases(scopedIds, targetSection.id);
    expect(result.copied).toBe(1);
    expect(result.failed).toBe(0);

    const sourceCases = await repo.listCases({ sectionId: sourceSection.id });
    const targetCases = await repo.listCases({ sectionId: targetSection.id });
    expect(sourceCases.map((row) => row.id)).toContain(firstCase.id);
    expect(targetCases).toHaveLength(1);
    expect(targetCases[0]).toMatchObject({
      title: "Checkout happy path",
      priority: "high",
      caseType: "regression",
      preconditions: "Customer is signed in",
      customValues: { component: "checkout", risk: "high" },
      automationKey: null,
      externalId: null
    });

    const copiedSteps = await repo.listCaseSteps(targetCases[0]!.id);
    expect(copiedSteps).toMatchObject([
      { stepOrder: 1, content: "Open checkout", expectedResult: "Cart appears" },
      { stepOrder: 2, content: "Submit payment", expectedResult: "Order is placed" }
    ]);
  });

  it("rejects target sections outside the project", async () => {
    const { repo, service, project } = await seedCatalog();
    const otherProject = await repo.createProject({ name: "Other", description: null, projectType: "multi_suite" });
    const otherSuite = (await repo.listSuitesByProject(otherProject.id))[0]!;
    const otherSection = await repo.createSection({ suiteId: otherSuite.id, parentSectionId: null, name: "Other Section" });

    await expect(service.assertProjectScopedSection(project.id, otherSection.id)).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
  });

  it("filters cases by query, priority, and case type", async () => {
    const { service, project } = await seedCatalog();

    await expect(
      service.listCases({
        projectId: project.id,
        q: "checkout",
        priority: "high",
        caseType: "regression"
      })
    ).resolves.toMatchObject([{ title: "Checkout happy path" }]);

    await expect(
      service.listCases({
        projectId: project.id,
        priority: "medium"
      })
    ).resolves.toMatchObject([{ title: "Profile save" }]);
  });

  it("bulk updates selected cases", async () => {
    const { repo, service, project, firstCase, secondCase } = await seedCatalog();

    const { scopedIds, outOfScope } = await service.resolveProjectScopedCaseIds(project.id, [firstCase.id, secondCase.id]);
    expect(outOfScope).toEqual([]);

    const result = await service.bulkUpdateCases(scopedIds, {
      priority: "low",
      caseType: "integration"
    });

    expect(result.updated).toBe(2);
    expect(result.failed).toBe(0);
    await expect(repo.getCase(firstCase.id)).resolves.toMatchObject({
      priority: "low",
      caseType: "integration"
    });
    await expect(repo.getCase(secondCase.id)).resolves.toMatchObject({
      priority: "low",
      caseType: "integration"
    });
  });

  it("archives active cases and hides them from the default list", async () => {
    const { service, project, firstCase, secondCase } = await seedCatalog();

    const { scopedIds, outOfScope } = await service.resolveProjectScopedCaseIds(project.id, [firstCase.id, secondCase.id]);
    expect(outOfScope).toEqual([]);

    const result = await service.bulkArchiveCases(scopedIds, true);
    expect(result.changed).toBe(2);
    expect(result.failed).toBe(0);

    await expect(service.listCases({ projectId: project.id })).resolves.toEqual([]);
    await expect(service.listCases({ projectId: project.id, state: "archived" })).resolves.toMatchObject([
      { id: firstCase.id },
      { id: secondCase.id }
    ]);
  });

  it("restores archived cases back into the active list", async () => {
    const { service, project, firstCase, secondCase } = await seedCatalog();

    await service.bulkArchiveCases([firstCase.id], true);
    const result = await service.bulkArchiveCases([firstCase.id], false);

    expect(result.changed).toBe(1);
    expect(result.failed).toBe(0);
    await expect(service.listCases({ projectId: project.id })).resolves.toMatchObject([
      { id: firstCase.id },
      { id: secondCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, state: "archived" })).resolves.toEqual([]);
  });

  it("filters cases by automation and searches metadata fields", async () => {
    const { repo, service, project, sourceSection, firstCase, secondCase } = await seedCatalog();

    const enrichedCase = await repo.createCase({
      projectId: project.id,
      sectionId: sourceSection.id,
      title: "Checkout automation import",
      priority: "high",
      caseType: "regression",
      estimate: "5m",
      refs: "REQ-100",
      labels: ["smoke", "checkout"],
      automationKey: "AUTO-100",
      externalId: "TC-100",
      preconditions: "Imported fixture",
      customValues: { component: "checkout", risk: "high" },
      archivedAt: null
    });

    await expect(service.listCases({ projectId: project.id, automation: "automated" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, automation: "manual" })).resolves.toMatchObject([
      { id: firstCase.id },
      { id: secondCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, q: "REQ-100" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, q: "smoke" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, q: "AUTO-100" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, refs: "with" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, labels: "with" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, estimate: "with" })).resolves.toMatchObject([
      { id: enrichedCase.id }
    ]);
    await expect(service.listCases({ projectId: project.id, refs: "without" })).resolves.toMatchObject([
      { id: firstCase.id },
      { id: secondCase.id }
    ]);
  });
});
