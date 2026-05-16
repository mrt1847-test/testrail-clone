import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, actions, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{eyebrow}</p>
          ) : null}
          <h1 className={`font-semibold text-slate-900 ${eyebrow ? "mt-0.5 text-xl" : "text-base"}`}>
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
