import { Button, OverflowMenu, WorkbenchPageHeader } from "../../../shared/ui";
import { useProjectArchived } from "../context/ProjectArchiveContext";
import { planListHeaderMenuGroups } from "../utils/planHeaderMenu";

type Props = {
  projectId: string;
  onAddPlan: () => void;
};

export function PlansHeader({ projectId, onAddPlan }: Props) {
  const isProjectArchived = useProjectArchived();

  return (
    <WorkbenchPageHeader
      title="Test Plans"
      description="Open a plan to compose entries and generate runs. Reports stay in More actions."
      primaryAction={
        <Button
          size="md"
          disabled={isProjectArchived}
          title={isProjectArchived ? "Archived projects are read-only" : "Create a test plan"}
          onClick={onAddPlan}
        >
          Add Plan
        </Button>
      }
      utilityAction={<OverflowMenu groups={planListHeaderMenuGroups(projectId)} />}
    />
  );
}
