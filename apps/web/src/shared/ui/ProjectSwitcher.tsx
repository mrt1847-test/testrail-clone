import { useQuery } from "@tanstack/react-query";

import { fetchSuites } from "../../features/projects/api/suitesApi";
import { usePinnedProjects } from "../../features/projects/hooks/usePinnedProjects";
import type { ProjectSummary } from "../../features/projects/types";
import { partitionPinnedProjects } from "../../features/projects/utils/pinnedProjects";
import {
  buildProjectContextMenu,
  projectContextMenuLabel
} from "../../features/projects/utils/projectContextMenu";
import {
  buildProjectSwitcherMenu,
  projectSwitcherLabel
} from "../../features/projects/utils/projectSwitcherMenu";
import { OverflowMenu } from "./OverflowMenu";

type ProjectSwitcherProps = {
  projects: ProjectSummary[];
  currentProjectId: string;
  isArchived?: boolean;
};

export function ProjectSwitcher({
  projects,
  currentProjectId,
  isArchived = false
}: ProjectSwitcherProps) {
  const { toggleProjectPin, pinDefaultSuite, pinnedSuiteFor, isProjectPinned, pinnedProjectIds } =
    usePinnedProjects();
  const { pinned, others } = partitionPinnedProjects(projects, pinnedProjectIds);
  const currentProject = projects.find((project) => project.id === currentProjectId);

  const suitesQuery = useQuery({
    queryKey: ["project-switcher-suites", currentProjectId],
    queryFn: () => fetchSuites(currentProjectId),
    enabled: Boolean(currentProjectId)
  });

  const suites = suitesQuery.data ?? [];
  const pinnedSuiteId = pinnedSuiteFor(currentProjectId);
  const pinnedSuiteName = suites.find((suite) => suite.id === pinnedSuiteId)?.name;
  const currentName = currentProject?.name ?? "Project";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <OverflowMenu
        label={projectSwitcherLabel(currentName, isArchived || Boolean(currentProject?.isArchived))}
        size="sm"
        align="left"
        triggerClassName="max-w-[12rem] truncate"
        groups={buildProjectSwitcherMenu({
          currentProjectId,
          currentProjectName: currentName,
          pinned,
          others,
          isCurrentPinned: isProjectPinned(currentProjectId),
          onTogglePin: toggleProjectPin
        })}
      />
      {currentProjectId && suites.length > 0 ? (
        <OverflowMenu
          label={projectContextMenuLabel(pinnedSuiteName)}
          size="sm"
          align="left"
          groups={buildProjectContextMenu({
            projectId: currentProjectId,
            suites,
            pinnedSuiteId,
            onPinSuite: (suiteId) => pinDefaultSuite(currentProjectId, suiteId)
          })}
        />
      ) : null}
    </div>
  );
}
