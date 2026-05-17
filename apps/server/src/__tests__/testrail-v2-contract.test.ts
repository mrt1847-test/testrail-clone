import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { labelIdFromTitle, mapLabelsForV2, mapSections } from "../modules/testrail/testrail.mappers.js";
import { TESTRAIL_V2_SUPPORTED } from "../modules/testrail/testrail.supported.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("/api/v2 TestRail adapter contract", () => {
  it("exposes supported endpoint index", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { supported: string[] };
    expect(body.supported).toContain("GET get_project/{project_id}");
    expect(body.supported).toContain("GET get_runs/{project_id}");
    expect(body.supported).toContain("GET get_suite/{suite_id}");
    expect(body.supported).toContain("GET get_section/{section_id}");
    expect(body.supported).toContain("GET get_results/{test_id}");
    expect(body.supported).toContain("GET get_case_types");
    expect(body.supported).toContain("GET get_priorities");
    expect(body.supported).toContain("GET get_case_statuses");
    expect(body.supported).toContain("GET get_datasets/{project_id}");
    expect(body.supported).toContain("GET get_variables/{project_id}");
    expect(body.supported).toContain("GET get_bdd_scenarios/{case_id}");
    expect(body.supported).toContain("GET get_bdd_result_scenarios/{result_id}");
    expect(body.supported).toContain("GET get_suites/{project_id}");
    expect(body.supported).toContain("GET get_statuses");
    expect(body.supported).toContain("GET get_configs/{project_id}");
    expect(body.supported).toContain("GET get_case_fields/{project_id}");
    expect(body.supported).toContain("GET get_reports");
    expect(body.supported).toContain("GET get_reports/{project_id}");
    expect(body.supported).toContain("GET get_roles");
    expect(body.supported).toContain("GET get_labels/{project_id}");
    expect(body.supported).toContain("GET get_groups");
    expect(body.supported).toContain("GET get_shared_steps/{project_id}");
    expect(body.supported).toContain("GET get_attachments_for_case/{case_id}");
    expect(body.supported).toContain("POST run_report/{report_id}");
    expect(body.supported).toContain("POST add_suite/{project_id}");
    expect(body.supported).toContain("POST close_run/{run_id}");
  });

  it("documents supported routes in TESTRAIL_V2_SUPPORTED", () => {
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_sections/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_milestones/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_templates/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_users");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_case_statuses");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_datasets/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_variables/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_reports");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_bdd_scenarios/{case_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST add_bdd_scenario/{case_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_attachments_for_result/{result_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST run_report/{report_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_labels/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_groups");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_shared_steps/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST add_suite/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST update_suite/{suite_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST add_section/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST update_section/{section_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST delete_section/{section_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST close_run/{run_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST update_run/{run_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_project/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_runs/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_results_for_run/{run_id}");
  });

  it("paginates get_cases with limit and offset envelope", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "V2 Pagination Project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/suites`,
      headers
    });
    const suite = (suiteRes.json() as { data: Array<{ id: string; isMaster: boolean }> }).data.find(
      (row) => row.isMaster
    )!;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suite.id}/sections`,
      headers,
      payload: { name: "Section" }
    });
    const section = sectionRes.json() as { data: { id: string } };

    for (let i = 0; i < 5; i += 1) {
      await app.inject({
        method: "POST",
        url: `/api/sections/${section.data.id}/cases`,
        headers,
        payload: { title: `Case ${i + 1}` }
      });
    }

    const pageRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_cases/${project.data.id}?limit=2&offset=1`
    });
    expect(pageRes.statusCode).toBe(200);
    const body = pageRes.json() as {
      offset: number;
      limit: number;
      size: number;
      cases: Array<{ id: number }>;
      _links: { next: string | null; prev: string | null };
    };
    expect(body.offset).toBe(1);
    expect(body.limit).toBe(2);
    expect(body.size).toBe(2);
    expect(body.cases).toHaveLength(2);
    expect(body._links.next).toEqual(expect.stringContaining("offset=3"));
    expect(body._links.prev).toEqual(expect.stringContaining("offset=0"));
  });

  it("paginates get_runs for a project", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "V2 Runs Pagination" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/suites`,
      headers
    });
    const suite = (suiteRes.json() as { data: Array<{ id: string; isMaster: boolean }> }).data.find(
      (row) => row.isMaster
    )!;

    await app.inject({
      method: "POST",
      url: `/api/v2/add_run/${project.data.id}`,
      headers,
      payload: { suite_id: suite.id, name: "Run A" }
    });

    const runsRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_runs/${project.data.id}?limit=10&offset=0`
    });
    expect(runsRes.statusCode).toBe(200);
    const body = runsRes.json() as { runs: Array<{ name: string }> };
    expect(body.runs.length).toBeGreaterThan(0);
    expect(body.runs[0]?.name).toBe("Run A");
  });

  it("rejects invalid limit on paginated list endpoints", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_cases/1?limit=999" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("exposes get_projects as a JSON array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; name: string; is_completed: boolean }>;
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns 404 for unknown case on get_case", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_case/999999999" });
    expect(res.statusCode).toBe(404);
  });

  it("returns get_statuses as a JSON array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_statuses" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; name: string; label: string }>;
    expect(body.length).toBeGreaterThanOrEqual(5);
    expect(body.some((row) => row.name === "passed")).toBe(true);
  });

  it("lists suites and sections for a created project", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "V2 Project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/suites`,
      headers
    });
    const suite = (suiteRes.json() as { data: Array<{ id: string; isMaster: boolean }> }).data.find(
      (row) => row.isMaster
    )!;

    await app.inject({
      method: "POST",
      url: `/api/suites/${suite.id}/sections`,
      headers,
      payload: { name: "V2 Section" }
    });

    const suitesRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_suites/${project.data.id}`
    });
    expect(suitesRes.statusCode).toBe(200);
    const suites = suitesRes.json() as Array<{ id: number; name: string; project_id: number }>;
    expect(suites.some((row) => row.id === Number(suite.id))).toBe(true);

    const sectionsRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_sections/${project.data.id}?suite_id=${suite.id}`
    });
    expect(sectionsRes.statusCode).toBe(200);
    const sections = sectionsRes.json() as Array<{ id: number; name: string; suite_id: number }>;
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0]?.suite_id).toBe(Number(suite.id));

    const milestonesRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_milestones/${project.data.id}`
    });
    expect(milestonesRes.statusCode).toBe(200);
    expect(Array.isArray(milestonesRes.json())).toBe(true);

    const catalogEndpoints = [
      `/api/v2/get_configs/${project.data.id}`,
      `/api/v2/get_case_fields/${project.data.id}`,
      `/api/v2/get_result_fields/${project.data.id}`,
      `/api/v2/get_templates/${project.data.id}`,
      `/api/v2/get_users/${project.data.id}`,
      `/api/v2/get_datasets/${project.data.id}`,
      `/api/v2/get_variables/${project.data.id}`,
      `/api/v2/get_reports/${project.data.id}`,
      `/api/v2/get_labels/${project.data.id}`,
      `/api/v2/get_shared_steps/${project.data.id}`,
      "/api/v2/get_roles",
      "/api/v2/get_groups"
    ];
    for (const url of catalogEndpoints) {
      const catalogRes = await app.inject({ method: "GET", url });
      expect(catalogRes.statusCode).toBe(200);
      expect(Array.isArray(catalogRes.json())).toBe(true);
    }

    const usersRes = await app.inject({ method: "GET", url: "/api/v2/get_users" });
    expect(usersRes.statusCode).toBe(200);
    expect(Array.isArray(usersRes.json())).toBe(true);

    const caseStatusesRes = await app.inject({ method: "GET", url: "/api/v2/get_case_statuses" });
    expect(caseStatusesRes.statusCode).toBe(200);
    const caseStatuses = caseStatusesRes.json() as Array<{ id: number; name: string; label: string }>;
    expect(caseStatuses.map((row) => row.name)).toEqual(["active", "archived"]);

    const reportsRes = await app.inject({ method: "GET", url: "/api/v2/get_reports", headers });
    expect(reportsRes.statusCode).toBe(200);
    expect(Array.isArray(reportsRes.json())).toBe(true);

    const attachmentsForCaseRes = await app.inject({
      method: "GET",
      url: "/api/v2/get_attachments_for_case/999999999"
    });
    expect(attachmentsForCaseRes.statusCode).toBe(200);
    expect(Array.isArray(attachmentsForCaseRes.json())).toBe(true);

    const attachmentsForResultRes = await app.inject({
      method: "GET",
      url: "/api/v2/get_attachments_for_result/999999999"
    });
    expect(attachmentsForResultRes.statusCode).toBe(200);
    expect(Array.isArray(attachmentsForResultRes.json())).toBe(true);

    const missingSuiteRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_sections/${project.data.id}`
    });
    expect(missingSuiteRes.statusCode).toBe(400);

    const sectionId = sections[0]?.id;
    expect(sectionId).toBeDefined();

    const labeledCaseRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_case/${sectionId}`,
      headers,
      payload: { title: "Labeled case", labels: ["smoke", "checkout"] }
    });
    expect(labeledCaseRes.statusCode).toBe(200);

    const labelsRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_labels/${project.data.id}`
    });
    expect(labelsRes.statusCode).toBe(200);
    const labels = labelsRes.json() as Array<{ id: number; title: string }>;
    expect(labels.map((row) => row.title).sort()).toEqual(["checkout", "smoke"]);
    expect(labels.every((row) => row.id === labelIdFromTitle(row.title))).toBe(true);

    const groupsRes = await app.inject({ method: "GET", url: "/api/v2/get_groups" });
    expect(groupsRes.statusCode).toBe(200);
    expect(groupsRes.json()).toEqual([]);

    const sharedStepsRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_shared_steps/${project.data.id}`
    });
    expect(sharedStepsRes.statusCode).toBe(200);
    expect(sharedStepsRes.json()).toEqual([]);
  });

  it("mutates suites, sections, and runs via v2 write endpoints", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "V2 Write Project", projectType: "multi_suite" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_suite/${project.data.id}`,
      headers,
      payload: { name: "V2 Added Suite", description: "initial" }
    });
    expect(suiteRes.statusCode).toBe(200);
    const suite = suiteRes.json() as { id: number; name: string; project_id: number };
    expect(suite.name).toBe("V2 Added Suite");
    expect(suite.project_id).toBe(Number(project.data.id));

    const updateSuiteRes = await app.inject({
      method: "POST",
      url: `/api/v2/update_suite/${suite.id}`,
      headers,
      payload: { description: "updated" }
    });
    expect(updateSuiteRes.statusCode).toBe(200);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_section/${project.data.id}`,
      headers,
      payload: { suite_id: suite.id, name: "V2 Section" }
    });
    expect(sectionRes.statusCode).toBe(200);
    const section = sectionRes.json() as { id: number; name: string; suite_id: number };
    expect(section.name).toBe("V2 Section");
    expect(section.suite_id).toBe(suite.id);

    const updateSectionRes = await app.inject({
      method: "POST",
      url: `/api/v2/update_section/${section.id}`,
      headers,
      payload: { name: "V2 Section Renamed" }
    });
    expect(updateSectionRes.statusCode).toBe(200);
    expect((updateSectionRes.json() as { name: string }).name).toBe("V2 Section Renamed");

    const tempSectionRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_section/${project.data.id}`,
      headers,
      payload: { suite_id: suite.id, name: "V2 Temp Section" }
    });
    const tempSection = tempSectionRes.json() as { id: number };
    const deleteSectionRes = await app.inject({
      method: "POST",
      url: `/api/v2/delete_section/${tempSection.id}`,
      headers
    });
    expect(deleteSectionRes.statusCode).toBe(200);

    const runCaseRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_case/${section.id}`,
      headers,
      payload: { title: "V2 Run Case" }
    });
    const runCase = runCaseRes.json() as { id: number };

    const addBddScenarioRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_bdd_scenario/${runCase.id}`,
      headers,
      payload: { name: "Checkout", scenario: "Given a cart\nWhen checkout succeeds\nThen an order exists" }
    });
    expect(addBddScenarioRes.statusCode).toBe(200);
    const bddScenario = addBddScenarioRes.json() as { id: number; case_id: number; scenario: string };
    expect(bddScenario.case_id).toBe(runCase.id);

    const bddScenariosRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_bdd_scenarios/${runCase.id}`
    });
    expect(bddScenariosRes.statusCode).toBe(200);
    expect((bddScenariosRes.json() as Array<{ id: number }>).some((row) => row.id === bddScenario.id)).toBe(true);

    const updateBddScenarioRes = await app.inject({
      method: "POST",
      url: `/api/v2/update_bdd_scenario/${bddScenario.id}`,
      headers,
      payload: { scenario: "Given a cart\nWhen checkout fails\nThen an error is shown" }
    });
    expect(updateBddScenarioRes.statusCode).toBe(200);

    const deleteBddScenarioRes = await app.inject({
      method: "POST",
      url: `/api/v2/delete_bdd_scenario/${bddScenario.id}`,
      headers
    });
    expect(deleteBddScenarioRes.statusCode).toBe(200);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_run/${project.data.id}`,
      headers,
      payload: { suite_id: suite.id, name: "V2 Run" }
    });
    expect(runRes.statusCode).toBe(200);
    const run = runRes.json() as { id: number; is_completed: boolean };
    expect(run.is_completed).toBe(false);

    const testsRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_tests/${run.id}`
    });
    const testsBody = testsRes.json() as { tests: Array<{ id: number; case_id: number }> };
    expect(testsBody.tests.length).toBeGreaterThan(0);
    const firstTest = testsBody.tests[0]!;

    const addResultRes = await app.inject({
      method: "POST",
      url: `/api/v2/add_result_for_case/${run.id}/${firstTest.case_id}`,
      headers,
      payload: { status_id: 1, comment: "v2 pass" }
    });
    expect(addResultRes.statusCode).toBe(200);

    const resultsForCaseRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_results_for_case/${run.id}/${firstTest.case_id}`
    });
    expect(resultsForCaseRes.statusCode).toBe(200);
    expect((resultsForCaseRes.json() as { results: unknown[] }).results.length).toBeGreaterThan(0);

    const resultsForRunRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_results_for_run/${run.id}`
    });
    expect(resultsForRunRes.statusCode).toBe(200);
    expect((resultsForRunRes.json() as { results: unknown[] }).results.length).toBeGreaterThan(0);

    const resultsForTestRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_results/${firstTest.id}`
    });
    expect(resultsForTestRes.statusCode).toBe(200);
    expect((resultsForTestRes.json() as { results: unknown[] }).results.length).toBeGreaterThan(0);

    const closeRunRes = await app.inject({
      method: "POST",
      url: `/api/v2/close_run/${run.id}`,
      headers
    });
    expect(closeRunRes.statusCode).toBe(200);
    expect((closeRunRes.json() as { is_completed: boolean }).is_completed).toBe(true);

    const updateRunRes = await app.inject({
      method: "POST",
      url: `/api/v2/update_run/${run.id}`,
      headers,
      payload: { name: "V2 Run Renamed" }
    });
    expect(updateRunRes.statusCode).toBe(200);
    expect((updateRunRes.json() as { name: string }).name).toBe("V2 Run Renamed");

    const getProjectRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_project/${project.data.id}`
    });
    expect(getProjectRes.statusCode).toBe(200);
    expect((getProjectRes.json() as { id: number; name: string }).name).toBe("V2 Write Project");

    const getSuiteRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_suite/${suite.id}`
    });
    expect(getSuiteRes.statusCode).toBe(200);
    expect((getSuiteRes.json() as { id: number }).id).toBe(suite.id);

    const getSectionRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_section/${section.id}`
    });
    expect(getSectionRes.statusCode).toBe(200);
    expect((getSectionRes.json() as { id: number; name: string }).name).toBe("V2 Section Renamed");

    const getRunRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_run/${run.id}`
    });
    expect(getRunRes.statusCode).toBe(200);
  });

  it("exposes static case type and priority catalogs", async () => {
    const typesRes = await app.inject({ method: "GET", url: "/api/v2/get_case_types" });
    expect(typesRes.statusCode).toBe(200);
    const types = typesRes.json() as Array<{ id: number; name: string }>;
    expect(types.some((row) => row.name === "functional")).toBe(true);

    const prioritiesRes = await app.inject({ method: "GET", url: "/api/v2/get_priorities" });
    expect(prioritiesRes.statusCode).toBe(200);
    const priorities = prioritiesRes.json() as Array<{ id: number; name: string }>;
    expect(priorities.some((row) => row.name === "high")).toBe(true);
  });
});

describe("testrail label mapper", () => {
  it("builds stable synthetic ids", () => {
    const labels = mapLabelsForV2(["smoke", "checkout"]);
    expect(labels[0]?.id).toBe(labelIdFromTitle("smoke"));
    expect(labels[0]?.title).toBe("smoke");
  });
});

describe("testrail section mapper", () => {
  it("computes nested depth", () => {
    const rows = mapSections([
      { id: 1n, suiteId: 10n, parentSectionId: null, name: "Root", displayOrder: 1 },
      { id: 2n, suiteId: 10n, parentSectionId: 1n, name: "Child", displayOrder: 2 }
    ]);
    expect(rows.find((row) => row.id === 1)?.depth).toBe(0);
    expect(rows.find((row) => row.id === 2)?.depth).toBe(1);
  });
});
