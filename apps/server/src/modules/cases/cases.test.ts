import { describe, expect, it } from "vitest";

import { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";
import { CasesService } from "./cases.service.js";

async function seedCatalog() {
  const repo = new ProjectsMemoryRepository();
  const service = new CasesService(repo);
  const project = await repo.createProject({ name: "Demo", description: null });
  const suite = await repo.createSuite({ projectId: project.id, name: "Suite", description: null });
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

  it("rejects target sections outside the project", async () => {
    const { repo, service, project } = await seedCatalog();
    const otherProject = await repo.createProject({ name: "Other", description: null });
    const otherSuite = await repo.createSuite({ projectId: otherProject.id, name: "Other Suite", description: null });
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
