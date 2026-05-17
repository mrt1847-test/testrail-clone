import type { FastifyInstance } from "fastify";
import { expect } from "vitest";

/** Default projects are single_repo: one auto-created master suite; extra POST /suites returns 409. */
export async function getMasterSuiteId(
  app: FastifyInstance,
  projectId: string,
  headers?: Record<string, string>
) {
  const suiteRes = await app.inject({
    method: "GET",
    url: `/api/projects/${projectId}/suites`,
    headers
  });
  expect(suiteRes.statusCode).toBe(200);
  const suites = (suiteRes.json() as { data: Array<{ id: string; isMaster: boolean }> }).data;
  const master = suites.find((row) => row.isMaster) ?? suites[0];
  expect(master).toBeTruthy();
  return master.id;
}

export async function createProject(
  app: FastifyInstance,
  headers: Record<string, string>,
  payload: { name: string; projectType?: string }
) {
  const projectRes = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers,
    payload
  });
  expect(projectRes.statusCode).toBe(200);
  return (projectRes.json() as { data: { id: string } }).data.id;
}
