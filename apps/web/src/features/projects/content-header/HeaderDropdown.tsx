import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { contentHeaderActionClass, contentHeaderDisabledClass } from "./contentHeaderStyles";

export type HeaderDropdownItem = {
  id: string;
  label: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  description?: string;
  onSelect?: () => void;
};

type Props = {
  label: string;
  items: HeaderDropdownItem[];
  disabled?: boolean;
  disabledTitle?: string;
  align?: "left" | "right";
  footer?: ReactNode;
};

export function HeaderDropdown({
  label,
  items,
  disabled = false,
  disabledTitle,
  align = "right",
  footer
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const enabledItems = items.filter((item) => !item.disabled);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={disabled ? contentHeaderDisabledClass : contentHeaderActionClass}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (disabled) return;
          setOpen((value) => !value);
        }}
      >
        {label}
        <span className="ml-1 text-[10px] text-slate-500" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && enabledItems.length > 0 ? (
        <div
          id={menuId}
          role="menu"
          className={[
            "absolute z-30 mt-1 min-w-[220px] rounded-md border border-slate-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          ].join(" ")}
        >
          {enabledItems.map((item) => {
            const className =
              "block w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400";
            if (item.href) {
              return (
                <a
                  key={item.id}
                  role="menuitem"
                  href={item.href}
                  className={className}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{item.description}</span>
                  ) : null}
                </a>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={className}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{item.description}</span>
                ) : null}
              </button>
            );
          })}
          {footer ? <div className="border-t border-slate-100 px-3 py-2">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
