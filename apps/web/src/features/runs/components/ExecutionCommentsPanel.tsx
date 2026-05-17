import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createRunExecutionComment,
  createTestExecutionComment,
  fetchRunExecutionComments,
  fetchTestExecutionComments,
  type ExecutionComment
} from "../api/runApi";

type Props = {
  scope: "test_instance" | "test_run";
  testId?: string;
  runId?: string;
  canPost?: boolean;
  emptyHint?: string;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function authorLabel(comment: ExecutionComment) {
  if (!comment.author) return "Unknown";
  return comment.author.name?.trim() || comment.author.email;
}

export function ExecutionCommentsPanel({
  scope,
  testId,
  runId,
  canPost = true,
  emptyHint = "No discussion comments yet."
}: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ["execution-comments", scope, testId ?? null, runId ?? null],
    [runId, scope, testId]
  );

  const enabled = scope === "test_instance" ? Boolean(testId) : Boolean(runId);

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      scope === "test_instance"
        ? fetchTestExecutionComments(testId!)
        : fetchRunExecutionComments(runId!),
    enabled
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const content = draft.trim();
      if (!content) throw new Error("Comment cannot be empty.");
      if (scope === "test_instance") {
        return createTestExecutionComment(testId!, { content, parentId: replyToId ?? undefined });
      }
      return createRunExecutionComment(runId!, { content, parentId: replyToId ?? undefined });
    },
    onSuccess: async () => {
      setDraft("");
      setReplyToId(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not post comment")
  });

  const topLevel = data.filter((comment) => !comment.parentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ExecutionComment[]>();
    for (const comment of data) {
      if (!comment.parentId) continue;
      const bucket = map.get(comment.parentId) ?? [];
      bucket.push(comment);
      map.set(comment.parentId, bucket);
    }
    return map;
  }, [data]);

  function renderComment(comment: ExecutionComment, depth = 0) {
    const replies = repliesByParent.get(comment.id) ?? [];
    return (
      <li key={comment.id} className={depth > 0 ? "ml-4 border-l border-slate-200 pl-3" : undefined}>
        <article className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{authorLabel(comment)}</span>
            <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{comment.content}</p>
          {canPost && depth === 0 ? (
            <button
              type="button"
              className="mt-2 text-xs font-medium text-slate-600 underline"
              onClick={() => {
                setReplyToId(comment.id);
                setError(null);
              }}
            >
              Reply
            </button>
          ) : null}
        </article>
        {replies.length > 0 ? (
          <ul className="mt-2 space-y-2">{replies.map((reply) => renderComment(reply, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }

  if (!enabled) return null;
  if (isLoading) return <LoadingState message="Loading discussion..." />;

  return (
    <div className="space-y-3">
      {topLevel.length === 0 ? <p className="text-sm text-slate-500">{emptyHint}</p> : null}
      {topLevel.length > 0 ? (
        <ul className="space-y-2">{topLevel.map((comment) => renderComment(comment))}</ul>
      ) : null}

      {canPost ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          {replyToId ? (
            <p className="text-xs text-slate-600">
              Replying to comment #{replyToId}{" "}
              <button type="button" className="underline" onClick={() => setReplyToId(null)}>
                Cancel
              </button>
            </p>
          ) : null}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Add a comment. Use @email or @name to mention teammates."
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={saveMutation.isPending || draft.trim().length === 0}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Posting..." : replyToId ? "Post reply" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="text-xs text-slate-500">You can read comments but cannot post without result entry permission.</p>
      )}
    </div>
  );
}
