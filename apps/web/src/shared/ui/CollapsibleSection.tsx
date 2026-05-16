import type { ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  className?: string;
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
  className = ""
}: CollapsibleSectionProps) {
  return (
    <details
      className={`group rounded-lg border border-slate-200 bg-white shadow-sm ${className}`.trim()}
      defaultOpen={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="text-slate-400 transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
          {title}
          {badge != null ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {badge}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-3 py-3">{children}</div>
    </details>
  );
}
