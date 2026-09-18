import { Button, OverflowMenu, WorkbenchPageHeader } from "../../../shared/ui";
import { useProjectArchived } from "../context/ProjectArchiveContext";
import { milestoneHeaderMenuGroups } from "../utils/milestoneHeaderMenu";

type Props = {
  projectId: string;
  onAddMilestone: () => void;
};

export function MilestonesHeader({ projectId, onAddMilestone }: Props) {
  const isProjectArchived = useProjectArchived();

  return (
    <WorkbenchPageHeader
      title="Milestones"
      description="Track release progress. Reports stay in More actions."
      primaryAction={
        <Button
          size="md"
          disabled={isProjectArchived}
          title={isProjectArchived ? "Archived projects are read-only" : "Create a milestone"}
          onClick={onAddMilestone}
        >
          Add Milestone
        </Button>
      }
      utilityAction={<OverflowMenu groups={milestoneHeaderMenuGroups(projectId)} />}
    />
  );
}
