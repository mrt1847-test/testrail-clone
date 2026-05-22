export type CommentTemplate = {
  id: string;
  name: string;
  body: string;
};

function storageKey(projectId: string) {
  return `comment-templates:${projectId}`;
}

export function loadCommentTemplates(projectId: string): CommentTemplate[] {
  if (!projectId) return [];
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is CommentTemplate =>
          typeof row === "object" &&
          row != null &&
          typeof (row as CommentTemplate).id === "string" &&
          typeof (row as CommentTemplate).name === "string" &&
          typeof (row as CommentTemplate).body === "string"
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function saveCommentTemplate(projectId: string, input: { name: string; body: string }): CommentTemplate[] {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!projectId || !name || !body) return loadCommentTemplates(projectId);
  const next: CommentTemplate = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    body
  };
  const rows = [next, ...loadCommentTemplates(projectId).filter((row) => row.name !== name)].slice(0, 30);
  localStorage.setItem(storageKey(projectId), JSON.stringify(rows));
  return rows;
}

export function deleteCommentTemplate(projectId: string, templateId: string): CommentTemplate[] {
  const rows = loadCommentTemplates(projectId).filter((row) => row.id !== templateId);
  localStorage.setItem(storageKey(projectId), JSON.stringify(rows));
  return rows;
}
