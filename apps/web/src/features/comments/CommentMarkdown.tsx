import type { ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const MENTION_RE = /(^|[\s([{"'])@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?)/g;

function renderBoldItalicCode(segment: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = segment;
  let index = 0;
  while (rest.length > 0) {
    const codeMatch = rest.match(/`([^`]+)`/);
    const boldMatch = rest.match(/\*\*([^*]+)\*\*/);
    const italicMatch = rest.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    const candidates = [
      codeMatch ? { kind: "code" as const, match: codeMatch } : null,
      boldMatch ? { kind: "bold" as const, match: boldMatch } : null,
      italicMatch ? { kind: "italic" as const, match: italicMatch } : null
    ].filter(Boolean) as Array<{ kind: "code" | "bold" | "italic"; match: RegExpMatchArray }>;
    if (candidates.length === 0) {
      parts.push(rest);
      break;
    }
    const earliest = candidates.sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0))[0]!;
    const at = earliest.match.index ?? 0;
    if (at > 0) parts.push(rest.slice(0, at));
    const key = `${keyPrefix}-${index}`;
    if (earliest.kind === "code") {
      parts.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
          {earliest.match[1]}
        </code>
      );
    } else if (earliest.kind === "bold") {
      parts.push(<strong key={key}>{earliest.match[1]}</strong>);
    } else {
      parts.push(<em key={key}>{earliest.match[1]}</em>);
    }
    rest = rest.slice(at + earliest.match[0].length);
    index += 1;
  }
  return parts;
}

function renderMentionsAndFormatting(segment: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let matchIndex = 0;
  for (const match of segment.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    const boundary = match[1] ?? "";
    const token = match[2] ?? "";
    if (start > last) {
      nodes.push(...renderBoldItalicCode(segment.slice(last, start), `${keyPrefix}-t-${matchIndex}`));
    }
    if (boundary) nodes.push(boundary);
    nodes.push(
      <span key={`${keyPrefix}-m-${matchIndex}`} className="font-medium text-indigo-800">
        @{token}
      </span>
    );
    last = start + match[0].length;
    matchIndex += 1;
  }
  if (last < segment.length) {
    nodes.push(...renderBoldItalicCode(segment.slice(last), `${keyPrefix}-tail`));
  }
  return nodes.length > 0 ? nodes : renderBoldItalicCode(segment, keyPrefix);
}

function renderLine(line: string, key: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let part = 0;
  for (const match of line.matchAll(LINK_RE)) {
    const start = match.index ?? 0;
    if (start > last) {
      nodes.push(...renderMentionsAndFormatting(line.slice(last, start), `${key}-p-${part}`));
      part += 1;
    }
    nodes.push(
      <a
        key={`${key}-l-${part}`}
        href={match[2]}
        className="text-indigo-700 underline"
        target="_blank"
        rel="noreferrer"
      >
        {match[1]}
      </a>
    );
    last = start + match[0].length;
    part += 1;
  }
  if (last < line.length) nodes.push(...renderMentionsAndFormatting(line.slice(last), `${key}-end`));
  return <>{nodes}</>;
}

/** Lightweight markdown baseline for comments (bold, italic, code, links, mentions). */
export function CommentMarkdown({ content, className }: { content: string; className?: string }) {
  if (!content.trim()) return null;
  const lines = content.split("\n");
  return (
    <div className={className ?? "whitespace-pre-wrap text-sm text-slate-800"}>
      {lines.map((line, index) => (
        <p key={index} className={index > 0 ? "mt-1" : undefined}>
          {line.length === 0 ? "\u00a0" : renderLine(line, `line-${index}`)}
        </p>
      ))}
    </div>
  );
}
