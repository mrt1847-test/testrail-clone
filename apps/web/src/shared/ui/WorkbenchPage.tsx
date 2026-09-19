import type { HTMLAttributes, ReactNode } from "react";

type WorkbenchPageProps = HTMLAttributes<HTMLDivElement>;

export function WorkbenchPage({ className, ...props }: WorkbenchPageProps) {
  return <div className={["grid gap-2", className].filter(Boolean).join(" ")} {...props} />;
}

type WorkbenchPageHeaderProps = {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  utilityAction?: ReactNode;
  compact?: boolean;
};

export function WorkbenchPageHeader({
  title,
  description,
  primaryAction,
  utilityAction,
  compact = false
}: WorkbenchPageHeaderProps) {
  return (
    <header
      className={
        compact
          ? "bg-transparent"
          : "border-b border-slate-200 bg-transparent dark:border-slate-700"
      }
      data-page-chrome="header"
    >
      <div
        className={
          compact
            ? "flex flex-wrap items-center justify-between gap-2 py-1"
            : "flex flex-wrap items-center justify-between gap-2 py-2"
        }
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {utilityAction}
          {primaryAction}
        </div>
      </div>
    </header>
  );
}

export function WorkbenchToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["flex flex-wrap items-center gap-2 bg-transparent py-1.5", className].filter(Boolean).join(" ")}
      role="toolbar"
      aria-label="Workbench tools"
      data-page-chrome="toolbar"
      {...props}
    />
  );
}
