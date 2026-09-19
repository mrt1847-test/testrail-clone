import type { OverflowMenuGroup } from "../../../shared/ui";

export type ProjectContextSuite = {
  id: string;
  name: string;
};

export function projectContextMenuLabel(pinnedSuiteName: string | undefined) {
  return pinnedSuiteName ? `Suite: ${pinnedSuiteName}` : "Suite";
}

export function buildProjectContextMenu(input: {
  projectId: string;
  suites: ProjectContextSuite[];
  pinnedSuiteId: string | null;
  onPinSuite: (suiteId: string | null) => void;
}): OverflowMenuGroup[] {
  return [
    {
      id: "default-suite",
      label: "Default suite",
      items: [
        {
          id: "none",
          label: "None pinned",
          selected: input.pinnedSuiteId == null,
          onSelect: () => input.onPinSuite(null)
        },
        ...input.suites.map((suite) => ({
          id: suite.id,
          label: suite.name,
          selected: input.pinnedSuiteId === suite.id,
          onSelect: () => input.onPinSuite(suite.id)
        }))
      ]
    },
    {
      id: "project",
      label: "Project",
      items: [
        {
          id: "settings",
          label: "Project settings",
          to: `/projects/${input.projectId}/settings`
        }
      ]
    }
  ];
}
