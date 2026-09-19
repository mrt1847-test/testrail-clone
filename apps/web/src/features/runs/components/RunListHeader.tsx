import { useMemo } from "react";

import { Button, OverflowMenu, WorkbenchPageHeader, type OverflowMenuGroup } from "../../../shared/ui";
import { useProjectArchived } from "../../projects/context/ProjectArchiveContext";
import { useDefectDropdownItems } from "../../projects/content-header/DefectsDropdown";
import { runListHeaderMenuGroups } from "../utils/runListHeaderMenu";

type Props = {
  projectId: string;
  onAddRun: () => void;
  onAddPlan: () => void;
};

export function RunListHeader({ projectId, onAddRun, onAddPlan }: Props) {
  const isProjectArchived = useProjectArchived();
  const defectItems = useDefectDropdownItems({ projectId });
  const groups = useMemo<OverflowMenuGroup[]>(() => {
    const coreGroups = runListHeaderMenuGroups(projectId).map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item }))
    }));
    const defects: OverflowMenuGroup = {
      id: "defects",
      label: "Defects",
      items: [
        ...defectItems.map((item) => ({
          ...item,
          to: item.external ? undefined : item.href,
          href: item.external ? item.href : undefined
        })),
        {
          id: "defect-settings",
          label: "Defect integration settings",
          to: `/projects/${projectId}/settings/defect-integration`
        }
      ]
    };
    return [...coreGroups, defects];
  }, [defectItems, projectId]);

  return (
    <WorkbenchPageHeader
      title="Test Runs & Results"
      primaryAction={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={isProjectArchived}
            title={isProjectArchived ? "Archived projects are read-only" : "Create a test plan"}
            onClick={onAddPlan}
          >
            Add Plan
          </Button>
          <Button
            size="md"
            disabled={isProjectArchived}
            title={isProjectArchived ? "Archived projects are read-only" : "Create a test run"}
            onClick={onAddRun}
          >
            Add Run
          </Button>
        </div>
      }
      utilityAction={<OverflowMenu groups={groups} />}
    />
  );
}
