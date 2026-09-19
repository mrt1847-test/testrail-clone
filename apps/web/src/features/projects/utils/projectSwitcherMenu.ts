import type { OverflowMenuGroup } from "../../../shared/ui";

export type SwitcherProject = {
  id: string;
  name: string;
  isArchived?: boolean;
};

export function projectSwitcherLabel(projectName: string, isArchived = false) {
  return isArchived ? `${projectName} (Archived)` : projectName;
}

function projectDescription(project: SwitcherProject, currentProjectId: string) {
  const parts = [
    project.id === currentProjectId ? "Current" : null,
    project.isArchived ? "Archived" : null
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function buildProjectSwitcherMenu(input: {
  currentProjectId: string;
  currentProjectName: string;
  pinned: SwitcherProject[];
  others: SwitcherProject[];
  isCurrentPinned: boolean;
  onTogglePin: (projectId: string) => void;
}): OverflowMenuGroup[] {
  const toItem = (project: SwitcherProject) => ({
    id: project.id,
    label: project.name,
    description: projectDescription(project, input.currentProjectId),
    selected: project.id === input.currentProjectId,
    to: `/projects/${project.id}`
  });

  const groups: OverflowMenuGroup[] = [];
  if (input.pinned.length > 0) {
    groups.push({
      id: "pinned",
      label: "Pinned",
      items: input.pinned.map(toItem)
    });
  }
  if (input.others.length > 0) {
    groups.push({
      id: "projects",
      label: input.pinned.length > 0 ? "Projects" : "Project",
      items: input.others.map(toItem)
    });
  }
  groups.push({
    id: "actions",
    label: "This project",
    items: [
      {
        id: "pin-current",
        label: input.isCurrentPinned
          ? `Unpin ${input.currentProjectName}`
          : `Pin ${input.currentProjectName}`,
        onSelect: () => input.onTogglePin(input.currentProjectId)
      },
      {
        id: "all-projects",
        label: "All projects",
        to: "/projects"
      }
    ]
  });
  return groups;
}
