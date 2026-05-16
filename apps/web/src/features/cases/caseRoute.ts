export function buildCaseListPath(projectId: string, sectionId?: number | null) {
  if (sectionId == null) return `/projects/${projectId}/cases`;
  return `/projects/${projectId}/cases?sectionId=${sectionId}`;
}

export function buildCaseDetailPath(
  projectId: string,
  caseId: number,
  options?: { sectionId?: number | null; mode?: "view" | "edit" }
) {
  const params = new URLSearchParams();
  if (options?.sectionId != null) params.set("sectionId", String(options.sectionId));
  if (options?.mode === "edit") params.set("mode", "edit");
  const query = params.toString();
  return `/projects/${projectId}/cases/${caseId}${query ? `?${query}` : ""}`;
}
