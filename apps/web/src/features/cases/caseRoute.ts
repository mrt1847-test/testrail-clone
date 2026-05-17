export type CaseListPathOptions = {
  sectionId?: number | null;
  caseId?: number | null;
  mode?: "view" | "edit";
};

export function buildCaseListPath(projectId: string, options?: CaseListPathOptions | number | null) {
  const normalized: CaseListPathOptions =
    typeof options === "number" || options === null || options === undefined
      ? { sectionId: options ?? undefined }
      : options;
  const params = new URLSearchParams();
  if (normalized.sectionId != null) params.set("sectionId", String(normalized.sectionId));
  if (normalized.caseId != null) params.set("caseId", String(normalized.caseId));
  if (normalized.mode === "edit") params.set("mode", "edit");
  const query = params.toString();
  return `/projects/${projectId}/cases${query ? `?${query}` : ""}`;
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
