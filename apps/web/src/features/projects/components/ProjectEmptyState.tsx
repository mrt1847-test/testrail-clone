import { EmptyState } from "../../../shared/ui/EmptyState";

type ProjectEmptyStateProps = {
  onCreateClick: () => void;
};

export function ProjectEmptyState({ onCreateClick }: ProjectEmptyStateProps) {
  return (
    <EmptyState
      title="No projects yet"
      description="Create a project to start organizing suites, cases, and runs."
      action={
        <button
          type="button"
          onClick={onCreateClick}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New project
        </button>
      }
    />
  );
}
