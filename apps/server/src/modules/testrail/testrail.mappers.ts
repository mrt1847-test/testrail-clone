import { testRailStatusMap } from "../../domain/testrailMapping.js";
import type { SectionRow, SuiteRow } from "../projects/projects.repository.js";

const DEFAULT_STATUS_LABELS: Record<string, string> = {
  passed: "Passed",
  blocked: "Blocked",
  untested: "Untested",
  retest: "Retest",
  failed: "Failed"
};

function canonicalToStatusId(canonical: string) {
  const found = Object.entries(testRailStatusMap).find(([, value]) => value === canonical);
  return found ? Number(found[0]) : 3;
}

function hexToTestRailColor(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return 0;
  return Number.parseInt(normalized, 16);
}

export function mapSuite(row: SuiteRow) {
  return {
    id: Number(row.id),
    project_id: Number(row.projectId),
    name: row.name,
    description: row.description ?? null,
    is_completed: false,
    is_baseline: row.isBaseline,
    is_master: row.isMaster
  };
}

export function mapSectionForV2(row: SectionRow, peers: SectionRow[]) {
  const mapped = mapSections(peers);
  return (
    mapped.find((item) => item.id === Number(row.id)) ?? {
      id: Number(row.id),
      suite_id: Number(row.suiteId),
      parent_id: row.parentSectionId ? Number(row.parentSectionId) : null,
      name: row.name,
      description: null,
      display_order: row.displayOrder ?? 0,
      depth: 0
    }
  );
}

export function mapSections(rows: SectionRow[]) {
  const byId = new Map(rows.map((row) => [row.id.toString(), row]));
  const depthFor = (row: SectionRow): number => {
    let depth = 0;
    let parentId = row.parentSectionId;
    const seen = new Set<string>();
    while (parentId) {
      const key = parentId.toString();
      if (seen.has(key)) break;
      seen.add(key);
      depth += 1;
      parentId = byId.get(key)?.parentSectionId ?? null;
    }
    return depth;
  };

  return rows
    .slice()
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || Number(a.id - b.id))
    .map((row) => ({
      id: Number(row.id),
      suite_id: Number(row.suiteId),
      parent_id: row.parentSectionId ? Number(row.parentSectionId) : null,
      name: row.name,
      description: null,
      display_order: row.displayOrder ?? 0,
      depth: depthFor(row)
    }));
}

export function mapMilestone(row: {
  id: bigint;
  projectId: bigint;
  name: string;
  description?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  isCompleted: boolean;
}) {
  return {
    id: Number(row.id),
    project_id: Number(row.projectId),
    name: row.name,
    description: row.description ?? null,
    start_on: row.startDate ? Math.floor(row.startDate.getTime() / 1000) : null,
    due_on: row.dueDate ? Math.floor(row.dueDate.getTime() / 1000) : null,
    is_started: row.startDate != null,
    is_completed: row.isCompleted,
    completed_on: row.isCompleted && row.dueDate ? Math.floor(row.dueDate.getTime() / 1000) : null
  };
}

export function mapPlan(row: {
  id: bigint;
  projectId: bigint;
  milestoneId?: bigint | null;
  name: string;
  description?: string | null;
  status: string;
}) {
  return {
    id: Number(row.id),
    project_id: Number(row.projectId),
    milestone_id: row.milestoneId ? Number(row.milestoneId) : null,
    name: row.name,
    description: row.description ?? null,
    is_completed: row.status === "closed"
  };
}

export function buildSystemStatuses() {
  return Object.entries(testRailStatusMap).map(([id, name]) => ({
    id: Number(id),
    name,
    label: DEFAULT_STATUS_LABELS[name] ?? name,
    color_dark: 0,
    color_medium: 0,
    color_bright: 0,
    is_system: true,
    is_final: name === "passed" || name === "failed" || name === "blocked"
  }));
}

export function mapCustomStatuses(
  rows: Array<{
    id: bigint;
    name: string;
    systemName: string;
    canonicalStatus: string;
    color: string;
    isFinal: boolean;
    isUntested: boolean;
    isSystem: boolean;
    displayOrder: number;
  }>
) {
  if (rows.length === 0) return buildSystemStatuses();

  return rows.map((row) => {
    const canonical = row.canonicalStatus;
    const statusId = canonicalToStatusId(canonical);
    return {
      id: statusId,
      name: row.systemName,
      label: row.name,
      color_dark: hexToTestRailColor(row.color),
      color_medium: hexToTestRailColor(row.color),
      color_bright: hexToTestRailColor(row.color),
      is_system: row.isSystem,
      is_final: row.isFinal,
      is_untested: row.isUntested,
      custom_status_id: Number(row.id)
    };
  });
}

export function statusIdForCanonical(canonical: string) {
  return canonicalToStatusId(canonical);
}

export function mapConfigurations(
  rows: Array<{
    id: bigint;
    name: string;
    displayOrder: number;
    configurations: Array<{ id: bigint; name: string; displayOrder: number; isActive: boolean }>;
  }>
) {
  return rows
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
    .map((group) => ({
      id: Number(group.id),
      name: group.name,
      configs: group.configurations
        .filter((config) => config.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
        .map((config) => ({
          id: Number(config.id),
          group_id: Number(group.id),
          name: config.name
        }))
    }));
}

export function mapCustomFieldsForV2(
  rows: Array<{
    id: bigint;
    name: string;
    systemName: string;
    scope: string;
    fieldType: string;
    options: unknown;
    isRequired: boolean;
    displayOrder: number;
  }>
) {
  return rows
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
    .map((row) => ({
      id: Number(row.id),
      name: row.systemName,
      system_name: row.systemName,
      label: row.name,
      scope: row.scope === "result" ? "result" : "case",
      type: row.fieldType,
      is_required: row.isRequired,
      configs: [
        {
          context: { is_global: true, project_ids: null },
          options: Array.isArray(row.options) ? { items: row.options } : {}
        }
      ]
    }));
}

export function mapCaseTemplatesForV2(
  rows: Array<{
    id: bigint;
    name: string;
    description: string | null;
    isDefault: boolean;
    displayOrder: number;
  }>
) {
  return rows
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
    .map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description,
      is_default: row.isDefault
    }));
}

export function mapUserForV2(row: { id: bigint; email: string; name: string; isActive: boolean }) {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    is_active: row.isActive
  };
}

export function mapSavedReportForV2(row: {
  id: bigint;
  projectId: bigint;
  name: string;
  reportType: string;
  createdBy: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: Number(row.id),
    project_id: Number(row.projectId),
    name: row.name,
    type: row.reportType,
    created_by: row.createdBy ? Number(row.createdBy) : null,
    created_on: Math.floor(row.createdAt.getTime() / 1000),
    updated_on: Math.floor(row.updatedAt.getTime() / 1000)
  };
}

const CASE_STATUS_CATALOG = [
  { id: 1, name: "active", label: "Active", is_default: true, is_system: true, is_archived: false },
  { id: 2, name: "archived", label: "Archived", is_default: false, is_system: true, is_archived: true }
] as const;

export function buildCaseStatusesCatalog() {
  return CASE_STATUS_CATALOG.map((row) => ({ ...row }));
}

export function buildDatasetsCatalog(projectId?: bigint) {
  void projectId;
  return [] as Array<{
    id: number;
    project_id: number;
    name: string;
    variables: Array<{ name: string; value: string }>;
  }>;
}

export function buildVariablesCatalog(projectId?: bigint) {
  void projectId;
  return [] as Array<{
    id: number;
    project_id: number;
    name: string;
    default_value: string | null;
  }>;
}

export function mapAttachmentForV2(row: {
  id: bigint;
  entityId: bigint;
  resultId?: bigint | null;
  fileName: string;
  contentType?: string | null;
  fileSize?: bigint | null;
  createdAt: Date;
  createdBy?: bigint | null;
}) {
  return {
    id: Number(row.id),
    name: row.fileName,
    filename: row.fileName,
    content_type: row.contentType ?? null,
    size: row.fileSize ? Number(row.fileSize) : null,
    entity_id: Number(row.entityId),
    result_id: row.resultId ? Number(row.resultId) : null,
    author_id: row.createdBy ? Number(row.createdBy) : null,
    created_on: Math.floor(row.createdAt.getTime() / 1000)
  };
}

export function mapRoleForV2(role: string, index: number) {
  return {
    id: index + 1,
    name: role,
    is_default: role === "viewer",
    permissions: {
      project_mutation: role === "owner" || role === "manager" || role === "tester",
      project_admin: role === "owner" || role === "manager"
    }
  };
}

/** Stable synthetic label id from title (no first-class Label table yet). */
export function labelIdFromTitle(title: string): number {
  let hash = 2166136261;
  for (let i = 0; i < title.length; i += 1) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = Math.abs(hash % 2_147_483_647);
  return normalized === 0 ? 1 : normalized;
}

export function mapLabelForV2(title: string) {
  return {
    id: labelIdFromTitle(title),
    title,
    created_by: null,
    created_on: null
  };
}

export function mapLabelsForV2(titles: string[]) {
  return titles.map(mapLabelForV2);
}

export function mapProjectForV2(row: { id: bigint; name: string }) {
  return {
    id: Number(row.id),
    name: row.name,
    is_completed: false,
    suite_mode: 1,
    url: null
  };
}

export function mapResultForV2(row: {
  id: bigint;
  testInstanceId: bigint;
  status: string;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects: string[];
  createdAt: Date;
}) {
  return {
    id: Number(row.id),
    test_id: Number(row.testInstanceId),
    status_id: statusIdForCanonical(row.status),
    created_on: Math.floor(row.createdAt.getTime() / 1000),
    assignedto_id: null,
    comment: row.comment ?? "",
    version: row.version ?? null,
    elapsed: row.elapsed ?? null,
    defects: row.defects.length > 0 ? row.defects.join(", ") : null,
    custom_step_results: [],
    attachment_ids: []
  };
}

const CASE_TYPE_CATALOG = [
  { id: 1, name: "acceptance", is_default: false },
  { id: 2, name: "accessibility", is_default: false },
  { id: 3, name: "automated", is_default: false },
  { id: 4, name: "compatibility", is_default: false },
  { id: 5, name: "functional", is_default: true },
  { id: 6, name: "other", is_default: false },
  { id: 7, name: "performance", is_default: false },
  { id: 8, name: "regression", is_default: false },
  { id: 9, name: "security", is_default: false },
  { id: 10, name: "smoke", is_default: false },
  { id: 11, name: "usability", is_default: false }
] as const;

const PRIORITY_CATALOG = [
  { id: 1, name: "low", is_default: false, short_name: "L" },
  { id: 2, name: "medium", is_default: false, short_name: "M" },
  { id: 3, name: "high", is_default: false, short_name: "H" },
  { id: 4, name: "critical", is_default: true, short_name: "C" }
] as const;

export function buildCaseTypesCatalog() {
  return CASE_TYPE_CATALOG.map((row) => ({ ...row }));
}

export function buildPrioritiesCatalog() {
  return PRIORITY_CATALOG.map((row) => ({ ...row }));
}
