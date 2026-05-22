export type UiDensity = "compact" | "comfortable";

export type UiDensitySurface = "case-repository" | "run-execution" | "planning-hubs" | "work-queue" | "overview";

export const DEFAULT_UI_DENSITY: UiDensity = "comfortable";

export function uiDensityStorageKey(
  projectId: string,
  surface: UiDensitySurface,
  userId?: string | null
): string {
  const user = userId?.trim() || "anonymous";
  return `ui-density:${user}:${projectId}:${surface}`;
}

export function parseUiDensity(value: string | null | undefined): UiDensity {
  return value === "compact" ? "compact" : "comfortable";
}

export function readUiDensity(
  projectId: string,
  surface: UiDensitySurface,
  userId?: string | null
): UiDensity {
  if (typeof window === "undefined") return DEFAULT_UI_DENSITY;
  return parseUiDensity(window.localStorage.getItem(uiDensityStorageKey(projectId, surface, userId)));
}

export function writeUiDensity(
  projectId: string,
  surface: UiDensitySurface,
  density: UiDensity,
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(uiDensityStorageKey(projectId, surface, userId), density);
}

export function tableDensityClasses(density: UiDensity) {
  if (density === "compact") {
    return {
      cell: "px-2 py-1 align-middle text-xs",
      header: "px-2 py-1.5 text-[10px]",
      groupHeader: "px-2 py-1 text-[10px]",
      table: "text-xs"
    };
  }
  return {
    cell: "px-3 py-2 align-middle text-sm",
    header: "px-3 py-2.5 text-xs",
    groupHeader: "px-3 py-2 text-xs",
    table: "text-sm"
  };
}

export function caseRowDensityClasses(density: UiDensity) {
  return density === "compact"
    ? { rowButton: "px-1 py-1.5 text-xs", title: "text-xs" }
    : { rowButton: "px-1 py-3 text-left text-sm", title: "text-sm" };
}

export const workbenchDensity = {
  pageGap: "gap-3",
  mainStack: "space-y-3",
  sidebarStack: "space-y-3",
  sidebarWidth: "20rem",
  panel: "border border-slate-200 bg-white shadow-sm",
  panelMuted: "border border-slate-200 bg-slate-50",
  panelHeader: "border-b border-slate-200 px-3 py-2",
  panelBody: "p-3",
  toolbar: "flex flex-wrap items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 shadow-sm",
  tableHeaderCell: "px-3 py-2",
  tableCell: "px-3 py-2",
  sidebarPanel: "border border-slate-200 bg-white p-3 shadow-sm",
  formGrid: "mt-2 grid gap-2",
  badge: "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium"
} as const;
