import { Button, OverflowMenu, WorkbenchPageHeader } from "../../../../shared/ui";
import { useProjectArchived } from "../../context/ProjectArchiveContext";
import { reportsCatalogHeaderMenuGroups } from "../../utils/reportHeaderMenu";

type Props = {
  projectId: string;
  onAddReport: () => void;
};

export function ReportsHeader({ projectId, onAddReport }: Props) {
  const isProjectArchived = useProjectArchived();

  return (
    <WorkbenchPageHeader
      title="Reports"
      description="Open a template to see results. Save, schedule, and export stay in More actions."
      primaryAction={
        <Button
          size="md"
          disabled={isProjectArchived}
          title={isProjectArchived ? "Archived projects are read-only" : "Save a named report"}
          onClick={onAddReport}
        >
          Add report
        </Button>
      }
      utilityAction={<OverflowMenu groups={reportsCatalogHeaderMenuGroups(projectId)} />}
    />
  );
}
