import { WEBHOOK_EVENTS, type WebhookEventPattern } from "./webhookEvents.js";

const SAMPLE_TIMESTAMP = "2026-05-22T12:00:00.000Z";
const SAMPLE_EVENT_ID = "9001";
const SAMPLE_ACTOR_USER_ID = "42";
const SAMPLE_ENTITY_ID = "501";
const SAMPLE_SIGNATURE = "sha256=7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8";

export type WebhookDeliveryBody = {
  id: string;
  projectId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type WebhookCatalogEntry = {
  event: WebhookEventPattern;
  description: string;
  samplePayload: WebhookDeliveryBody;
  sampleHeaders: {
    "Content-Type": string;
    "X-Webhook-Event": string;
    "X-Webhook-Signature": string;
  };
};

function resolveConcreteEventType(subscriptionEvent: string): string {
  if (subscriptionEvent === "*") return "case.updated";
  if (subscriptionEvent.endsWith(".*")) {
    const prefix = subscriptionEvent.slice(0, -2);
    const defaults: Record<string, string> = {
      case: "case.updated",
      suite: "suite.updated",
      section: "section.updated",
      run: "run.updated",
      result: "result.created",
      attachment: "attachment.created",
      milestone: "milestone.updated",
      plan: "plan.updated",
      configuration_group: "configuration_group.updated",
      configuration: "configuration.updated",
      requirement: "requirement.updated"
    };
    return defaults[prefix] ?? `${prefix}.updated`;
  }
  return subscriptionEvent;
}

function entityTypeForEvent(eventType: string): string {
  const [domain] = eventType.split(".");
  if (domain === "test") return "test";
  if (domain === "configuration_group") return "configuration_group";
  return domain;
}

function entityIdForEvent(eventType: string): string {
  const [domain] = eventType.split(".");
  const ids: Record<string, string> = {
    case: "501",
    suite: "11",
    section: "31",
    run: "201",
    test: "301",
    result: "401",
    attachment: "601",
    defect: "701",
    milestone: "81",
    plan: "91",
    configuration_group: "101",
    configuration: "111",
    requirement: "121"
  };
  return ids[domain] ?? SAMPLE_ENTITY_ID;
}

function titleForEvent(eventType: string): string {
  const titles: Record<string, string> = {
    "case.created": "Test case created",
    "case.updated": "Test case updated",
    "case.deleted": "Test case deleted",
    "case.bulk_deleted": "Test cases deleted",
    "case.bulk_moved": "Test cases moved",
    "case.bulk_copied": "Test cases copied",
    "case.bulk_updated": "Test cases updated",
    "case.bulk_archived": "Test cases archived",
    "case.bulk_restored": "Test cases restored",
    "case.reordered": "Test cases reordered",
    "case.version_restored": "Test case version restored",
    "case.step_created": "Test case step created",
    "case.step_updated": "Test case step updated",
    "case.step_deleted": "Test case step deleted",
    "suite.created": "Suite created",
    "suite.updated": "Suite updated",
    "suite.deleted": "Suite deleted",
    "section.created": "Section created",
    "section.updated": "Section updated",
    "section.moved": "Section moved",
    "section.deleted": "Section deleted",
    "section.reordered": "Sections reordered",
    "section.copied": "Section copied",
    "run.created": "Test run created",
    "run.updated": "Test run updated",
    "run.assigned": "Test run assigned",
    "run.closed": "Test run closed",
    "run.reopened": "Test run reopened",
    "run.tests_added": "Tests added to run",
    "run.test_removed": "Test removed from run",
    "run.rerun_created": "Rerun created",
    "test.assigned": "Test assigned",
    "result.created": "Result added",
    "result.failed": "Failed result added",
    "result.bulk_created": "Bulk results added",
    "attachment.created": "Attachment uploaded",
    "attachment.deleted": "Attachment deleted",
    "defect.linked": "Defect linked",
    "defect.unlinked": "Defect unlinked",
    "defect.pushed": "Defect pushed to tracker",
    "milestone.created": "Milestone created",
    "milestone.updated": "Milestone updated",
    "milestone.completed": "Milestone completed",
    "milestone.deleted": "Milestone deleted",
    "plan.created": "Test plan created",
    "plan.updated": "Test plan updated",
    "plan.deleted": "Test plan deleted",
    "plan.entry_created": "Plan entry created",
    "plan.entry_updated": "Plan entry updated",
    "plan.entry_deleted": "Plan entry deleted",
    "configuration_group.created": "Configuration group created",
    "configuration_group.updated": "Configuration group updated",
    "configuration_group.deleted": "Configuration group deleted",
    "configuration.created": "Configuration created",
    "configuration.updated": "Configuration updated",
    "configuration.deleted": "Configuration deleted",
    "requirement.created": "Requirement created",
    "requirement.updated": "Requirement updated",
    "requirement.deleted": "Requirement deleted",
    "requirement.linked": "Requirement linked",
    "requirement.unlinked": "Requirement unlinked"
  };
  return titles[eventType] ?? `Activity: ${eventType}`;
}

function bodyForEvent(eventType: string): string | null {
  if (eventType.startsWith("case.")) return "Login flow — valid credentials";
  if (eventType.startsWith("run.")) return "Sprint 12 regression";
  if (eventType.startsWith("result.")) return "Login flow — valid credentials in Sprint 12 regression was marked failed.";
  if (eventType === "test.assigned") return "Assigned to qa.lead@example.com";
  if (eventType.startsWith("defect.")) return "BUG-1234";
  if (eventType.startsWith("milestone.")) return "Release 2.0";
  if (eventType.startsWith("plan.")) return "Cross-browser matrix";
  return null;
}

function payloadForEvent(eventType: string): Record<string, unknown> | null {
  const [domain, action] = eventType.split(".");
  if (domain === "case") {
    if (action?.startsWith("bulk_")) {
      return { caseIds: ["501", "502", "503"], count: 3 };
    }
    if (action === "step_created" || action === "step_updated" || action === "step_deleted") {
      return { caseId: "501", stepId: "12" };
    }
    if (action === "version_restored") {
      return { caseId: "501", versionId: "8" };
    }
    if (action === "reordered") {
      return { caseIds: ["501", "502"], sectionId: "31" };
    }
    return { caseId: "501" };
  }
  if (domain === "suite") return { suiteId: "11" };
  if (domain === "section") {
    if (action === "copied") return { sectionId: "31", targetSectionId: "32" };
    if (action === "moved") return { sectionId: "31", parentId: "30" };
    if (action === "reordered") return { sectionIds: ["31", "32"] };
    return { sectionId: "31", suiteId: "11" };
  }
  if (domain === "run") {
    if (action === "tests_added") return { runId: "201", testIds: ["301", "302"] };
    if (action === "test_removed") return { runId: "201", testId: "301" };
    if (action === "rerun_created") return { runId: "201", rerunRunId: "202" };
    if (action === "assigned") return { runId: "201", assignedToUserId: "42" };
    return { runId: "201" };
  }
  if (domain === "test") return { testId: "301", runId: "201", assignedToUserId: "42" };
  if (domain === "result") {
    if (action === "bulk_created") return { resultIds: ["401", "402"], runId: "201" };
    return {
      resultId: "401",
      testId: "301",
      runId: "201",
      status: action === "failed" ? "failed" : "passed"
    };
  }
  if (domain === "attachment") {
    return { attachmentId: "601", entityType: "case", entityId: "501", filename: "screenshot.png" };
  }
  if (domain === "defect") {
    return { defectKey: "BUG-1234", testId: "301", runId: "201" };
  }
  if (domain === "milestone") return { milestoneId: "81" };
  if (domain === "plan") {
    if (action?.startsWith("entry_")) return { planId: "91", entryId: "95" };
    return { planId: "91" };
  }
  if (domain === "configuration_group") return { configurationGroupId: "101" };
  if (domain === "configuration") return { configurationId: "111", configurationGroupId: "101" };
  if (domain === "requirement") {
    if (action === "linked" || action === "unlinked") {
      return { requirementId: "121", caseId: "501" };
    }
    return { requirementId: "121" };
  }
  return null;
}

function describeWebhookEvent(subscriptionEvent: WebhookEventPattern): string {
  if (subscriptionEvent === "*") {
    return "Subscribe to every activity event delivered for this project.";
  }
  if (subscriptionEvent.endsWith(".*")) {
    const label = subscriptionEvent.slice(0, -2).replaceAll("_", " ");
    return `Subscribe to all ${label} activity events (wildcard pattern).`;
  }
  const concrete = resolveConcreteEventType(subscriptionEvent);
  return `Subscribe to the ${concrete} activity event.`;
}

export function buildSampleWebhookBody(
  subscriptionEvent: string,
  projectId: string
): WebhookDeliveryBody {
  const eventType = resolveConcreteEventType(subscriptionEvent);
  return {
    id: SAMPLE_EVENT_ID,
    projectId,
    actorUserId: SAMPLE_ACTOR_USER_ID,
    entityType: entityTypeForEvent(eventType),
    entityId: entityIdForEvent(eventType),
    eventType,
    title: titleForEvent(eventType),
    body: bodyForEvent(eventType),
    payload: payloadForEvent(eventType),
    createdAt: SAMPLE_TIMESTAMP
  };
}

export function buildWebhookEventCatalog(projectId: string): WebhookCatalogEntry[] {
  return WEBHOOK_EVENTS.map((event) => {
    const samplePayload = buildSampleWebhookBody(event, projectId);
    return {
      event,
      description: describeWebhookEvent(event),
      samplePayload,
      sampleHeaders: {
        "Content-Type": "application/json",
        "X-Webhook-Event": samplePayload.eventType,
        "X-Webhook-Signature": SAMPLE_SIGNATURE
      }
    };
  });
}
