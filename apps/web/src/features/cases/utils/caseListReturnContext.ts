/** Capture and restore case-repository list query when leaving full authoring (UI-072 / CA-U04). */

/** Allowlisted list keys only — never accept arbitrary external return URLs. */
export const CASE_LIST_RETURN_KEYS = [
  "suiteId",
  "sectionId",
  "scope",
  "display",
  "q",
  "priority",
  "caseType",
  "automation",
  "refs",
  "labels",
  "estimate",
  "state",
  "groupBy",
  "columns"
] as const;

export type CaseListReturnKey = (typeof CASE_LIST_RETURN_KEYS)[number];

export const CASE_LIST_RETURN_PARAM = "return";
export const CASE_LIST_SAVED_NOTICE_PARAM = "savedNotice";
export const CASE_LIST_SAVED_CASE_PARAM = "savedCaseId";

export function captureCaseListReturnQuery(params: URLSearchParams): string | null {
  const captured = new URLSearchParams();
  for (const key of CASE_LIST_RETURN_KEYS) {
    const value = params.get(key);
    if (value != null && value !== "") captured.set(key, value);
  }
  const raw = captured.toString();
  return raw.length > 0 ? raw : null;
}

/** Parse a return payload and drop any non-allowlisted keys. */
export function parseCaseListReturnQuery(raw: string | null | undefined): URLSearchParams {
  const safe = new URLSearchParams();
  if (raw == null || raw.trim() === "") return safe;
  let incoming: URLSearchParams;
  try {
    incoming = new URLSearchParams(raw);
  } catch {
    return safe;
  }
  for (const key of CASE_LIST_RETURN_KEYS) {
    const value = incoming.get(key);
    if (value != null && value !== "") safe.set(key, value);
  }
  return safe;
}

export function withCaseListReturnParam(
  params: URLSearchParams,
  listParams: URLSearchParams | null | undefined
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!listParams) {
    next.delete(CASE_LIST_RETURN_PARAM);
    return next;
  }
  const existing = listParams.get(CASE_LIST_RETURN_PARAM);
  if (existing) {
    next.set(CASE_LIST_RETURN_PARAM, existing);
    return next;
  }
  const captured = captureCaseListReturnQuery(listParams);
  if (captured) next.set(CASE_LIST_RETURN_PARAM, captured);
  else next.delete(CASE_LIST_RETURN_PARAM);
  return next;
}

export function buildCaseListPathFromReturn(input: {
  projectId: string;
  returnQuery?: string | null;
  fallback?: { suiteId?: string | null; sectionId?: number | null };
  panelCaseId?: number | null;
  focusCaseId?: number | null;
  savedNotice?: boolean;
}): string {
  const params = parseCaseListReturnQuery(input.returnQuery);
  if ([...params.keys()].length === 0 && input.fallback) {
    if (input.fallback.suiteId) params.set("suiteId", input.fallback.suiteId);
    if (input.fallback.sectionId != null) params.set("sectionId", String(input.fallback.sectionId));
  }
  if (input.panelCaseId != null) {
    params.set("panelCaseId", String(input.panelCaseId));
    params.set("focusCaseId", String(input.focusCaseId ?? input.panelCaseId));
  }
  if (input.savedNotice && input.panelCaseId != null) {
    params.set(CASE_LIST_SAVED_NOTICE_PARAM, "1");
    params.set(CASE_LIST_SAVED_CASE_PARAM, String(input.panelCaseId));
  } else {
    params.delete(CASE_LIST_SAVED_NOTICE_PARAM);
    params.delete(CASE_LIST_SAVED_CASE_PARAM);
  }

  const path = `/projects/${input.projectId}/cases`;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** True when active list filters likely hide this case (do not auto-clear filters). */
export function isCaseLikelyHiddenByListReturn(input: {
  returnQuery?: string | null;
  title: string;
  priority: string;
  type: string;
  automationStatus?: string;
}): boolean {
  const params = parseCaseListReturnQuery(input.returnQuery);
  const q = (params.get("q") ?? "").trim().toLowerCase();
  if (q && !input.title.toLowerCase().includes(q)) return true;

  const priority = (params.get("priority") ?? "").trim().toLowerCase();
  if (priority && input.priority.trim().toLowerCase() !== priority) return true;

  const caseType = (params.get("caseType") ?? "").trim().toLowerCase();
  if (caseType && input.type.trim().toLowerCase() !== caseType) return true;

  const automation = (params.get("automation") ?? "").trim().toLowerCase();
  if (automation && (input.automationStatus ?? "").trim().toLowerCase() !== automation) return true;

  return false;
}
