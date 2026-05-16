export type EmailPreferenceInput = {
  assignmentEnabled: boolean;
  failedResultEnabled: boolean;
  mentionEnabled: boolean;
  digestEnabled: boolean;
};

export function shouldSendImmediateEmail(preference: EmailPreferenceInput, notificationType: string) {
  if (preference.digestEnabled) return false;
  if (notificationType === "assignment") return preference.assignmentEnabled;
  if (notificationType === "failed_result") return preference.failedResultEnabled;
  if (notificationType === "mention") return preference.mentionEnabled;
  return true;
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
