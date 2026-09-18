import type { HTMLAttributes, ReactNode } from "react";

type WorkbenchPageProps = HTMLAttributes<HTMLDivElement>;

export function WorkbenchPage({ className, ...props }: WorkbenchPageProps) {
  return <div className={["grid gap-3", className].filter(Boolean).join(" ")} {...props} />;
}

type WorkbenchPageHeaderProps = {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  utilityAction?: ReactNode;
};

export function WorkbenchPageHeader({
  title,
  description,
  primaryAction,
  utilityAction
}: WorkbenchPageHeaderProps) {
  return (
    <header className="border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
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
      className={["bg-white", className].filter(Boolean).join(" ")}
      role="toolbar"
      aria-label="Workbench tools"
      {...props}
    />
  );
}
