import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProjectMembers } from "../projects/api/settingsApi";
import { CommentMarkdown } from "./CommentMarkdown";
import {
  filterMembersForMention,
  insertMentionAtCursor,
  mentionQueryAtCursor,
  mentionTokenForMember
} from "./commentMention";
import { deleteCommentTemplate, loadCommentTemplates, saveCommentTemplate } from "./commentTemplates";

type Props = {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  showTemplates?: boolean;
  showPreview?: boolean;
  textareaClassName?: string;
};

export function CommentComposer({
  projectId,
  value,
  onChange,
  rows = 3,
  placeholder = "Add a comment. Use @email to mention teammates. Markdown: **bold**, *italic*, `code`, [link](url).",
  disabled = false,
  id,
  label,
  showTemplates = true,
  showPreview = true,
  textareaClassName
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templates, setTemplates] = useState(() => loadCommentTemplates(projectId));
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["project-members", projectId, "comment-mentions"],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId)
  });

  useEffect(() => {
    setTemplates(loadCommentTemplates(projectId));
  }, [projectId]);

  const mentionState = useMemo(() => mentionQueryAtCursor(value, cursor), [cursor, value]);
  const mentionCandidates = useMemo(() => {
    if (!mentionState) return [];
    return filterMembersForMention(membersQuery.data ?? [], mentionState.query);
  }, [mentionState, membersQuery.data]);

  const mentionOpen = Boolean(mentionState && mentionCandidates.length > 0 && !disabled);

  function syncCursor() {
    const el = textareaRef.current;
    if (!el) return;
    setCursor(el.selectionStart ?? value.length);
  }

  function applyMention(member: (typeof mentionCandidates)[number]) {
    if (!mentionState) return;
    const token = mentionTokenForMember(member);
    const next = insertMentionAtCursor(value, cursor, mentionState.start, token);
    onChange(next.text);
    setCursor(next.cursor);
    setMentionIndex(0);
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function handleTemplateInsert(templateId: string) {
    const row = templates.find((item) => item.id === templateId);
    if (!row) return;
    onChange(value.trim().length > 0 ? `${value.trimEnd()}\n\n${row.body}` : row.body);
    setTemplateFeedback(`Inserted “${row.name}”.`);
    window.setTimeout(() => setTemplateFeedback(null), 2000);
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name || !value.trim()) return;
    setTemplates(saveCommentTemplate(projectId, { name, body: value.trim() }));
    setTemplateName("");
    setSaveTemplateOpen(false);
    setTemplateFeedback(`Saved template “${name}”.`);
    window.setTimeout(() => setTemplateFeedback(null), 2000);
  }

  const textareaCls =
    textareaClassName ??
    "w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500";

  return (
    <div className="space-y-2">
      {label ? <span className="block text-xs font-medium text-slate-600">{label}</span> : null}
      {showTemplates && projectId ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-slate-600">
            <span className="font-medium">Template</span>
            <select
              className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
              defaultValue=""
              disabled={disabled || templates.length === 0}
              onChange={(e) => {
                handleTemplateInsert(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">{templates.length === 0 ? "No templates" : "Insert template…"}</option>
              {templates.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {!saveTemplateOpen ? (
            <button
              type="button"
              disabled={disabled || !value.trim()}
              className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setSaveTemplateOpen(true)}
            >
              Save as template
            </button>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="min-w-[8rem] rounded border border-slate-300 px-2 py-1"
              />
              <button
                type="button"
                className="rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
                disabled={!templateName.trim()}
                onClick={handleSaveTemplate}
              >
                Save
              </button>
              <button type="button" className="text-slate-600 underline" onClick={() => setSaveTemplateOpen(false)}>
                Cancel
              </button>
            </span>
          )}
          {templates.length > 0 ? (
            <button
              type="button"
              className="text-slate-500 underline"
              disabled={disabled}
              onClick={() => {
                const row = templates[0];
                if (!row || !window.confirm(`Delete template “${row.name}”?`)) return;
                setTemplates(deleteCommentTemplate(projectId, row.id));
              }}
            >
              Delete latest
            </button>
          ) : null}
          {showPreview ? (
            <label className="ml-auto flex items-center gap-1 text-slate-600">
              <input
                type="checkbox"
                checked={previewOpen}
                onChange={(e) => setPreviewOpen(e.target.checked)}
              />
              Preview
            </label>
          ) : null}
        </div>
      ) : null}
      {templateFeedback ? <p className="text-xs text-slate-600">{templateFeedback}</p> : null}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          className={textareaCls}
          onChange={(e) => {
            onChange(e.target.value);
            setCursor(e.target.selectionStart ?? e.target.value.length);
          }}
          onClick={syncCursor}
          onKeyUp={syncCursor}
          onSelect={syncCursor}
          onKeyDown={(e) => {
            if (!mentionOpen) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMentionIndex((i) => Math.min(i + 1, mentionCandidates.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMentionIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const pick = mentionCandidates[mentionIndex];
              if (pick) applyMention(pick);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setMentionIndex(0);
            }
          }}
        />
        {mentionOpen ? (
          <ul
            className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            role="listbox"
          >
            {mentionCandidates.map((member, index) => (
              <li key={member.userId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === mentionIndex}
                  className={
                    index === mentionIndex
                      ? "w-full px-3 py-1.5 text-left bg-slate-100 text-slate-900"
                      : "w-full px-3 py-1.5 text-left text-slate-800 hover:bg-slate-50"
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMention(member)}
                >
                  <span className="font-medium">{member.name?.trim() || member.email}</span>
                  <span className="ml-2 text-xs text-slate-500">{member.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {showPreview && previewOpen && value.trim() ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Preview</p>
          <CommentMarkdown content={value} />
        </div>
      ) : null}
    </div>
  );
}
