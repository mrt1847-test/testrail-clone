import type { OverflowMenuGroup } from "../../../shared/ui";

/** Header overflow: catalog navigation, not actions on the open report. */
export const REPORT_NAVIGATION_MENU_LABEL = "Reports";

/** Result overflow: save, print, and export for the report on screen. */
export const REPORT_ACTIONS_MENU_LABEL = "This report";

/**
 * Catalog utilities stay out of Add report so opening a template remains
 * the dominant reports-index action.
 */
export function reportsCatalogHeaderMenuGroups(projectId: string): OverflowMenuGroup[] {
  return [
    {
      id: "admin",
      label: "Manage",
      items: [
        {
          id: "saved",
          label: "Saved & exports",
          description: "Schedules, saved views, and export history",
          to: `/projects/${projectId}/reports/saved`
        }
      ]
    }
  ];
}

/**
 * Drilldown navigation stays out of the results surface. Export, print, and
 * save-view belong in the result overflow, not this header.
 */
export function reportDetailHeaderMenuGroups(projectId: string): OverflowMenuGroup[] {
  return [
    {
      id: "catalog",
      label: "Reports",
      items: [
        {
          id: "all-reports",
          label: "All reports",
          description: "Open the report catalog",
          to: `/projects/${projectId}/reports`
        },
        {
          id: "saved",
          label: "Saved & exports",
          description: "Schedules and export history",
          to: `/projects/${projectId}/reports/saved`
        }
      ]
    }
  ];
}

export function reportResultMenuGroups(input: {
  printPath?: string | null;
  disabled?: boolean;
  onSaveView: () => void;
  onExportCsv: () => void;
  onQueueExport: () => void;
}): OverflowMenuGroup[] {
  const outputItems: OverflowMenuGroup["items"] = [];
  if (input.printPath && !input.disabled) {
    outputItems.push({
      id: "print",
      label: "Print view",
      description: "Open a printable report",
      to: input.printPath
    });
  }
  outputItems.push(
    {
      id: "csv",
      label: "Export CSV",
      description: "Download this report now",
      disabled: input.disabled,
      onSelect: input.onExportCsv
    },
    {
      id: "queue",
      label: "Queue export",
      description: "Run export in the background",
      disabled: input.disabled,
      onSelect: input.onQueueExport
    }
  );
  return [
    {
      id: "views",
      label: "Views",
      items: [
        {
          id: "save-view",
          label: "Save view",
          description: "Keep these filters as a named report",
          onSelect: input.onSaveView
        }
      ]
    },
    {
      id: "output",
      label: "Output",
      items: outputItems
    }
  ];
}
