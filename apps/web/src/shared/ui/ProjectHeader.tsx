type ProjectHeaderProps = {
  projectName: string;
  /** 앱 브랜드 옆 보조 텍스트 */
  subtitle?: string;
};

export function ProjectHeader({ projectName, subtitle }: ProjectHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</p>
          <h1 className="text-xl font-semibold text-slate-900">{projectName}</h1>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
