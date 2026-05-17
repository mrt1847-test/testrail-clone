export type CaseListPathOptions = {
  sectionId?: number | null;
  /** @deprecated use panelCaseId */
  caseId?: number | null;
  panelCaseId?: number | null;
  panelMode?: "view" | "edit";
  mode?: "view" | "edit";
};

export function buildCaseListPath(projectId: string, options?: CaseListPathOptions | number | null) {
  const normalized: CaseListPathOptions =
    typeof options === "number" || options === null || options === undefined
      ? { sectionId: options ?? undefined }
      : options;
  const params = new URLSearchParams();
  if (normalized.sectionId != null) params.set("sectionId", String(normalized.sectionId));
  const panelId = normalized.panelCaseId ?? normalized.caseId;
  if (panelId != null) params.set("panelCaseId", String(panelId));
  if (normalized.panelMode === "edit") params.set("panelMode", "edit");
  else if (normalized.mode === "edit") params.set("panelMode", "edit");
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
