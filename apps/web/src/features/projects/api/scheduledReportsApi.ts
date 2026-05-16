import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { ReportExportType } from "./reportsApi";
import type { SavedReportFilters } from "./savedReportsApi";

export type ScheduledReportRow = {
  id: string;
  projectId: string;
  name: string;
  savedReportId: string | null;
  reportType: ReportExportType;
  filters: SavedReportFilters | null;
  intervalMinutes: number;
  recipientEmails: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastExportJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: ScheduledReportRow & { id: string | number; projectId: string | number; savedReportId?: string | number | null; lastExportJobId?: string | number | null }): ScheduledReportRow {
  return {
    ...row,
    id: String(row.id),
    projectId: String(row.projectId),
    savedReportId: row.savedReportId != null ? String(row.savedReportId) : null,
    lastExportJobId: row.lastExportJobId != null ? String(row.lastExportJobId) : null,
    lastRunAt: row.lastRunAt ?? null,
    nextRunAt: row.nextRunAt ?? null
  };
}

export async function fetchScheduledReports(projectId: string): Promise<ScheduledReportRow[]> {
  const res = await apiFetch<Paged<ScheduledReportRow>>(`/api/projects/${projectId}/scheduled-reports?page=1&pageSize=50`);
  return res.data.map(mapRow);
}

export async function createScheduledReport(input: {
  projectId: string;
  name: string;
  savedReportId?: string;
  reportType?: ReportExportType;
  filters?: SavedReportFilters;
  intervalMinutes: number;
  recipientEmails: string[];
  enabled?: boolean;
}): Promise<ScheduledReportRow> {
  const res = await apiFetch<Ok<ScheduledReportRow>>(`/api/projects/${input.projectId}/scheduled-reports`, {
    method: "POST",
    body: {
      name: input.name,
      savedReportId: input.savedReportId,
      reportType: input.reportType,
      filters: input.filters,
      intervalMinutes: input.intervalMinutes,
      recipientEmails: input.recipientEmails,
      enabled: input.enabled
    }
  });
  return mapRow(res.data);
}

export async function updateScheduledReport(input: {
  projectId: string;
  scheduledReportId: string;
  name?: string;
  intervalMinutes?: number;
  recipientEmails?: string[];
  enabled?: boolean;
}): Promise<ScheduledReportRow> {
  const res = await apiFetch<Ok<ScheduledReportRow>>(
    `/api/projects/${input.projectId}/scheduled-reports/${input.scheduledReportId}`,
    {
      method: "PATCH",
      body: {
        name: input.name,
        intervalMinutes: input.intervalMinutes,
        recipientEmails: input.recipientEmails,
        enabled: input.enabled
      }
    }
  );
  return mapRow(res.data);
}

export async function deleteScheduledReport(projectId: string, scheduledReportId: string): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/scheduled-reports/${scheduledReportId}`, { method: "DELETE" });
}

export async function runScheduledReportNow(projectId: string, scheduledReportId: string) {
  const res = await apiFetch<
    Ok<{
      skipped: boolean;
      jobId?: string;
      totalRows?: number;
      fileName?: string;
      nextRunAt?: string;
      reason?: string;
    }>
  >(`/api/projects/${projectId}/scheduled-reports/${scheduledReportId}/run`, { method: "POST" });
  return res.data;
}
