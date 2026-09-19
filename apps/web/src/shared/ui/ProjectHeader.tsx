type ProjectHeaderProps = {
  projectName: string;
  isArchived?: boolean;
};

/** Project identity now lives in ProjectSwitcher so this heading row is unused by ProjectLayout. */
export function ProjectHeader({ projectName, isArchived = false }: ProjectHeaderProps) {
  return (
    <div className="shell-bar border-b px-4 py-1.5">
      <div className="mx-auto flex max-w-[90rem] min-w-0 items-center gap-2">
        <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{projectName}</h1>
        {isArchived ? (
          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            Archived
          </span>
        ) : null}
      </div>
    </div>
  );
}
