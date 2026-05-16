import type { ButtonHTMLAttributes } from "react";

import { formatStatusLabel, statusBadgeClassName } from "./statusStyles";

type StatusBadgeProps = {
  status: string;
  label?: string;
  size?: "sm" | "md";
  interactive?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function StatusBadge({
  status,
  label,
  size = "sm",
  interactive = false,
  className = "",
  type,
  ...buttonProps
}: StatusBadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  const tone = statusBadgeClassName(status);
  const text = label ?? formatStatusLabel(status);

  if (interactive) {
    return (
      <button
        type={type ?? "button"}
        className={`inline-flex rounded-full font-medium ring-1 ring-inset hover:brightness-95 ${sizeClass} ${tone} ${className}`.trim()}
        {...buttonProps}
      >
        {text}
      </button>
    );
  }

  return (
    <span className={`inline-flex rounded-full font-medium ring-1 ring-inset ${sizeClass} ${tone} ${className}`.trim()}>
      {text}
    </span>
  );
}
