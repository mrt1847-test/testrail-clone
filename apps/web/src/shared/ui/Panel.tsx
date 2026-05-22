import type { ReactNode } from "react";

type PanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padding?: boolean;
};

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "",
  padding = true
}: PanelProps) {
  const hasHeader = title != null || description != null || actions != null;

  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`${padding ? "p-4" : ""} ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
