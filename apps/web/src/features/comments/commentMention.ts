import type { ProjectMemberRow } from "../projects/api/settingsApi";

const MENTION_BOUNDARY_RE = /(^|[\s([{"'])@([A-Za-z0-9._%+-]*)$/;

export function mentionQueryAtCursor(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const match = before.match(MENTION_BOUNDARY_RE);
  if (!match || match.index == null) return null;
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  return { start: atIndex, query: match[2] ?? "" };
}

export function mentionTokenForMember(member: ProjectMemberRow) {
  return `@${member.email}`;
}

export function filterMembersForMention(members: ProjectMemberRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return members.slice(0, 8);
  return members
    .filter((member) => {
      const email = member.email.toLowerCase();
      const local = email.split("@")[0] ?? "";
      const name = (member.name ?? "").toLowerCase();
      return email.includes(needle) || local.includes(needle) || name.includes(needle);
    })
    .slice(0, 8);
}

export function insertMentionAtCursor(text: string, cursor: number, start: number, token: string) {
  const next = `${text.slice(0, start)}${token} ${text.slice(cursor)}`;
  const nextCursor = start + token.length + 1;
  return { text: next, cursor: nextCursor };
}
