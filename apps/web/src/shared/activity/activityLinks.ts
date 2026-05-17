export type ActivityLinkTarget = {
  entityType: string;
  entityId: string;
  eventType?: string;
  payload?: Record<string, unknown> | null;
};

const asString = (value: unknown) => (typeof value === "string" ? value : null);

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

export function caseHref(projectId: string, caseId: string) {
  return `/projects/${projectId}/cases?caseId=${encodeURIComponent(caseId)}`;
}

export function casesSectionHref(projectId: string, sectionId: string | null | undefined) {
  if (sectionId) {
    return `/projects/${projectId}/cases?sectionId=${encodeURIComponent(sectionId)}`;
  }
  return `/projects/${projectId}/cases`;
}

export function runHref(projectId: string, runId: string, testId?: string | null) {
  if (testId) {
    return `/projects/${projectId}/runs/${runId}?testId=${encodeURIComponent(testId)}`;
  }
  return `/projects/${projectId}/runs/${runId}`;
}

export function myTestsHref(projectId: string) {
  return `/projects/${projectId}/my-tests`;
}

export type ActivitySecondaryLink = {
  label: string;
  href: string;
};

/** Extra navigation targets for assignment-related notifications. */
export function getActivitySecondaryLinks(projectId: string, row: ActivityLinkTarget): ActivitySecondaryLink[] {
  if (row.eventType === "test.assigned" || row.eventType === "run.assigned") {
    return [{ label: "My Tests", href: myTestsHref(projectId) }];
  }
  return [];
}

/** Primary navigation target for an activity or notification row. */
export function getActivityPrimaryHref(projectId: string, row: ActivityLinkTarget): string | null {
  const payload = row.payload ?? {};
  const runId = asString(payload.runId);
  const testId = asString(payload.testId);
  const caseId = asString(payload.caseId);
  const reportType = asString(payload.reportType);
  const milestoneId = asString(payload.milestoneId);
  const planId = asString(payload.planId);

  if (row.eventType === "run.tests_added" && runId) {
    return runHref(projectId, runId);
  }
  if (row.eventType === "run.test_removed" && runId) {
    return runHref(projectId, runId, testId);
  }

  if (testId && runId) return runHref(projectId, runId, testId);
  if (runId) return runHref(projectId, runId);
  if (caseId) return caseHref(projectId, caseId);
  if (row.entityType === "run") return runHref(projectId, row.entityId);
  if (row.entityType === "case") return caseHref(projectId, row.entityId);
  if (row.entityType === "milestone") return `/projects/${projectId}/milestones/${row.entityId}`;
  if (milestoneId) return `/projects/${projectId}/milestones/${milestoneId}`;
  if (row.entityType === "plan") return `/projects/${projectId}/plans/${row.entityId}`;
  if (row.entityType === "plan_entry" && planId) return `/projects/${projectId}/plans/${planId}`;
  if (planId) return `/projects/${projectId}/plans/${planId}`;
  if (row.entityType === "suite") return `/projects/${projectId}/cases`;

  if (row.entityType === "section" || (row.eventType && row.eventType.startsWith("section."))) {
    if (row.eventType === "section.deleted") return casesSectionHref(projectId, null);
    const sectionId =
      asString(payload.sectionId) ??
      asString(payload.copiedSectionId) ??
      (row.entityType === "section" ? row.entityId : null);
    return casesSectionHref(projectId, sectionId);
  }
  if (row.entityType === "requirement") return `/projects/${projectId}/reports/traceability`;
  if (row.eventType === "report.saved" || row.eventType === "report.saved_updated") {
    return `/projects/${projectId}/reports/saved`;
  }
  if (row.eventType === "report.export_requested" || row.eventType === "report.export_downloaded") {
    return `/projects/${projectId}/reports/saved`;
  }

  if (row.entityType === "report") {
    if (reportType === "run_summary") return `/projects/${projectId}/reports/runs`;
    if (reportType === "milestone_summary") return `/projects/${projectId}/reports/milestones`;
    if (reportType === "plan_summary") return `/projects/${projectId}/reports/plans`;
    if (reportType === "traceability") return `/projects/${projectId}/reports/traceability`;
    if (reportType === "coverage_gap") return `/projects/${projectId}/reports/coverage`;
    if (reportType === "defect_coverage") return `/projects/${projectId}/reports/defects`;
    if (reportType === "defect_summary") return `/projects/${projectId}/reports/defect-summary`;
    if (reportType === "case_activity_summary") return `/projects/${projectId}/reports/case-activity`;
    if (reportType === "results_case_comparison") return `/projects/${projectId}/reports/results-comparison`;
    if (reportType === "results_property_distribution") return `/projects/${projectId}/reports/results-properties`;
    if (reportType === "refs_coverage") return `/projects/${projectId}/reports/refs-coverage`;
    if (reportType === "refs_comparison") return `/projects/${projectId}/reports/refs-comparison`;
    if (reportType === "refs_defect_summary") return `/projects/${projectId}/reports/refs-defects`;
    if (reportType === "project_summary") return `/projects/${projectId}/reports/project-summary`;
    if (reportType === "users_workload_summary") return `/projects/${projectId}/reports/users-workload`;
    return `/projects/${projectId}/reports/explorer`;
  }
  return null;
}

export type ActivityCaseLink = {
  caseId: string;
  label: string;
  href: string;
};

/** Secondary case links for run composition activity events. */
export function getActivityCompositionCaseLinks(projectId: string, row: ActivityLinkTarget): ActivityCaseLink[] {
  const payload = row.payload ?? {};
  if (row.eventType === "run.tests_added") {
    const caseIds = asStringArray(payload.addedCaseIds);
    return caseIds.slice(0, 12).map((id) => ({
      caseId: id,
      label: `C${id}`,
      href: caseHref(projectId, id)
    }));
  }
  if (row.eventType === "run.test_removed") {
    const caseId = asString(payload.caseId);
    if (!caseId) return [];
    return [{ caseId, label: `C${caseId}`, href: caseHref(projectId, caseId) }];
  }
  return [];
}
