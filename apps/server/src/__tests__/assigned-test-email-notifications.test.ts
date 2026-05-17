import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { getPrismaClient } from "../db/prisma.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function login(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "password" }
  });
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

describe("assigned test email notifications", () => {
  it.skipIf(!integrationEnabled)(
    "notifies assignee on assignment, comment, and result when preferences allow",
    async () => {
      const ownerHeaders = await login("admin@example.com");
      const assigneeEmail = `assignee-notify-${Date.now()}@example.com`;

      const projectRes = await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: ownerHeaders,
        payload: { name: "Assignee notify project" }
      });
      const projectId = (projectRes.json() as { data: { id: string } }).data.id;

      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/settings/members`,
        headers: ownerHeaders,
        payload: { email: assigneeEmail, role: "tester" }
      });

      const assigneeHeaders = await login(assigneeEmail);
      const membersRes = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/settings/members`,
        headers: ownerHeaders
      });
      const assigneeUserId = (
        membersRes.json() as { data: Array<{ email: string; userId: string }> }
      ).data.find((row) => row.email === assigneeEmail)?.userId;
      expect(assigneeUserId).toBeTruthy();

      const runRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs`,
        headers: ownerHeaders,
        payload: { name: "Notify run", includeAll: true }
      });
      const runId = (runRes.json() as { data: { id: string } }).data.id;

      const suiteId = await getMasterSuiteId(app, projectId, ownerHeaders);
      const sectionRes = await app.inject({
        method: "POST",
        url: `/api/suites/${suiteId}/sections`,
        headers: ownerHeaders,
        payload: { name: "SEC" }
      });
      const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

      const caseRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers: ownerHeaders,
        payload: { title: "Notify case" }
      });
      const caseId = (caseRes.json() as { data: { id: string } }).data.id;

      await app.inject({
        method: "POST",
        url: `/api/runs/${runId}/tests`,
        headers: ownerHeaders,
        payload: { caseIds: [caseId] }
      });

      const instancesRes = await app.inject({
        method: "GET",
        url: `/api/runs/${runId}?includeInstances=true`,
        headers: ownerHeaders
      });
      const testId = (
        instancesRes.json() as { data: { instances: Array<{ id: string }> } }
      ).data.instances[0]?.id;
      expect(testId).toBeTruthy();

      const assignRes = await app.inject({
        method: "PATCH",
        url: `/api/tests/${testId}/assignee`,
        headers: ownerHeaders,
        payload: { assignedTo: assigneeUserId }
      });
      expect(assignRes.statusCode).toBe(200);

      const prisma = getPrismaClient();
      const assignmentNotifications = await prisma.notification.findMany({
        where: { projectId: BigInt(projectId), userId: BigInt(assigneeUserId!), type: "assignment" },
        orderBy: { id: "desc" },
        take: 5
      });
      expect(assignmentNotifications.length).toBeGreaterThan(0);

      const assignmentOutbox = await prisma.emailOutbox.findMany({
        where: {
          projectId: BigInt(projectId),
          userId: BigInt(assigneeUserId!),
          recipientEmail: assigneeEmail,
          kind: "immediate"
        },
        orderBy: { id: "desc" },
        take: 5
      });
      expect(assignmentOutbox.some((row) => row.subject.toLowerCase().includes("assignment"))).toBe(true);

      await app.inject({
        method: "POST",
        url: `/api/tests/${testId}/execution-comments`,
        headers: ownerHeaders,
        payload: { content: "Please verify on staging." }
      });

      const activityAfterComment = await prisma.notification.findMany({
        where: { projectId: BigInt(projectId), userId: BigInt(assigneeUserId!), type: "activity" },
        orderBy: { id: "desc" },
        take: 5
      });
      expect(activityAfterComment.length).toBeGreaterThan(0);

      const resultRes = await app.inject({
        method: "POST",
        url: `/api/tests/${testId}/results`,
        headers: ownerHeaders,
        payload: { status: "passed", comment: "Looks good" }
      });
      expect(resultRes.statusCode).toBe(200);

      const activityAfterResult = await prisma.notification.findMany({
        where: { projectId: BigInt(projectId), userId: BigInt(assigneeUserId!), type: "activity" },
        orderBy: { id: "desc" },
        take: 10
      });
      expect(activityAfterResult.length).toBeGreaterThanOrEqual(2);

      await app.inject({
        method: "PATCH",
        url: `/api/projects/${projectId}/notification-preferences`,
        headers: assigneeHeaders,
        payload: { activityEnabled: false }
      });

      const activityCountBeforeOptOut = await prisma.notification.count({
        where: { projectId: BigInt(projectId), userId: BigInt(assigneeUserId!), type: "activity" }
      });

      await app.inject({
        method: "POST",
        url: `/api/tests/${testId}/execution-comments`,
        headers: ownerHeaders,
        payload: { content: "Second comment after opt-out." }
      });

      const activityCountAfterOptOut = await prisma.notification.count({
        where: { projectId: BigInt(projectId), userId: BigInt(assigneeUserId!), type: "activity" }
      });
      expect(activityCountAfterOptOut).toBe(activityCountBeforeOptOut);
    }
  );
});
