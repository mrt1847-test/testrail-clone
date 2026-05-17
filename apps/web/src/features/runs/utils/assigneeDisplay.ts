import type { ProjectMemberRow } from "../../projects/api/settingsApi";

export function memberLabelForUserId(
  userId: string | null | undefined,
  members: readonly ProjectMemberRow[]
): string {
  if (!userId) return "Unassigned";
  const member = members.find((row) => row.userId === userId);
  return member?.name?.trim() || member?.email || `User ${userId}`;
}
