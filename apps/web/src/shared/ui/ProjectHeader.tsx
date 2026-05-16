type ProjectHeaderProps = {
  projectName: string;
  /** 앱 브랜드 옆 보조 텍스트 */
  subtitle?: string;
  isArchived?: boolean;
};

export function ProjectHeader({ projectName, subtitle, isArchived = false }: ProjectHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{projectName}</h1>
            {isArchived ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                Archived
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
