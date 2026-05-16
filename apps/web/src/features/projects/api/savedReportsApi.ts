import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { ReportExportType } from "./reportsApi";

export type SavedReportFilters = {
  ui?: Record<string, string>;
  export?: Record<string, unknown>;
};

export type SavedReportRow = {
  id: string;
  projectId: string;
  name: string;
  reportType: ReportExportType;
  filters: SavedReportFilters | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: SavedReportRow & { id: string | number; projectId: string | number }): SavedReportRow {
  return {
    ...row,
    id: String(row.id),
    projectId: String(row.projectId)
  };
}

export async function fetchSavedReports(projectId: string): Promise<SavedReportRow[]> {
  const res = await apiFetch<Paged<SavedReportRow>>(`/api/projects/${projectId}/saved-reports?page=1&pageSize=50`);
  return res.data.map(mapRow);
}

export async function createSavedReport(input: {
  projectId: string;
  name: string;
  reportType: ReportExportType;
  filters?: SavedReportFilters;
}): Promise<SavedReportRow> {
  const res = await apiFetch<Ok<SavedReportRow>>(`/api/projects/${input.projectId}/saved-reports`, {
    method: "POST",
    body: {
      name: input.name,
      reportType: input.reportType,
      filters: input.filters ?? {}
    }
  });
  return mapRow(res.data);
}

export async function updateSavedReport(input: {
  projectId: string;
  savedReportId: string;
  name?: string;
  filters?: SavedReportFilters;
}): Promise<SavedReportRow> {
  const res = await apiFetch<Ok<SavedReportRow>>(
    `/api/projects/${input.projectId}/saved-reports/${input.savedReportId}`,
    {
      method: "PATCH",
      body: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.filters !== undefined ? { filters: input.filters } : {})
      }
    }
  );
  return mapRow(res.data);
}

export async function deleteSavedReport(projectId: string, savedReportId: string): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/saved-reports/${savedReportId}`, { method: "DELETE" });
}
