import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  selectedCount: number;
};

export function SelectionActionBar({
  selectedCount,
  className,
  children,
  ...props
}: Props) {
  if (selectedCount < 1) return null;

  return (
    <div
      {...props}
      role="region"
      aria-label={props["aria-label"] ?? "Selected item actions"}
      className={[
        "sticky top-0 z-20 border-y border-sky-200 bg-sky-50/95 px-3 py-2 shadow-sm backdrop-blur",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
