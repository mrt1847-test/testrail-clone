export type EmailPreferenceInput = {
  assignmentEnabled: boolean;
  failedResultEnabled: boolean;
  activityEnabled: boolean;
  mentionEnabled: boolean;
  digestEnabled: boolean;
};

export function shouldSendImmediateEmail(preference: EmailPreferenceInput, notificationType: string) {
  if (preference.digestEnabled) return false;
  if (notificationType === "assignment") return preference.assignmentEnabled;
  if (notificationType === "failed_result") return preference.failedResultEnabled;
  if (notificationType === "activity") return preference.activityEnabled;
  if (notificationType === "mention") return preference.mentionEnabled;
  return true;
}

export function buildNotificationActionPath(
  projectId: bigint | string,
  notificationType: string,
  payload?: Record<string, unknown> | null
) {
  const pid = String(projectId);
  const runId = typeof payload?.runId === "string" ? payload.runId : null;
  const testId = typeof payload?.testId === "string" ? payload.testId : null;
  if (testId && runId) {
    return `/projects/${pid}/runs/${runId}?testId=${encodeURIComponent(testId)}`;
  }
  if (runId) return `/projects/${pid}/runs/${runId}`;
  if (notificationType === "assignment") return `/projects/${pid}/my-tests`;
  return `/projects/${pid}/notifications`;
}

export function buildNotificationActionUrl(
  webOrigin: string,
  projectId: bigint | string,
  notificationType: string,
  payload?: Record<string, unknown> | null
) {
  const origin = webOrigin.replace(/\/$/, "");
  return `${origin}${buildNotificationActionPath(projectId, notificationType, payload)}`;
}

export function buildImmediateEmailBody(
  notification: { type: string; title: string; body: string | null },
  projectName: string,
  actionUrl?: string | null
) {
  const lines = [
    `Project: ${projectName}`,
    `Type: ${notification.type}`,
    notification.title,
    notification.body ?? ""
  ].filter(Boolean);
  if (actionUrl) lines.push("", `Open: ${actionUrl}`);
  return lines.join("\n");
}

export function buildDigestBodyForTest(
  projectName: string,
  notifications: Array<{ type: string; title: string; body: string | null; createdAt: Date }>
) {
  const header = `Digest for ${projectName} (${notifications.length} notification${notifications.length === 1 ? "" : "s"})`;
  const items = notifications
    .map((row, index) => {
      const when = row.createdAt.toISOString();
      return `${index + 1}. [${row.type}] ${row.title}${row.body ? ` — ${row.body}` : ""} (${when})`;
    })
    .join("\n");
  return `${header}\n\n${items}`;
}
