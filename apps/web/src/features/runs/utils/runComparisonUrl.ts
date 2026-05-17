export function buildRunComparisonPath(
  projectId: string,
  input?: { runIdA?: string; runIdB?: string; change?: string }
): string {
  const params = new URLSearchParams();
  if (input?.runIdA) params.set("runA", input.runIdA);
  if (input?.runIdB) params.set("runB", input.runIdB);
  if (input?.change && input.change !== "all") params.set("change", input.change);
  const qs = params.toString();
  return `/projects/${projectId}/runs/compare${qs ? `?${qs}` : ""}`;
}
