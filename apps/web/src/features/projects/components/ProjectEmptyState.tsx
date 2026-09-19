import { Button } from "../../../shared/ui";
import { EmptyState } from "../../../shared/ui/EmptyState";

type ProjectEmptyStateProps = {
  onCreateClick?: () => void;
};

export function ProjectEmptyState({ onCreateClick }: ProjectEmptyStateProps) {
  return (
    <EmptyState
      title="No projects yet"
      description="Create a project to start organizing suites, cases, and runs."
      action={
        onCreateClick ? (
          <Button size="sm" onClick={onCreateClick}>
            Add project
          </Button>
        ) : undefined
      }
    />
  );
}
