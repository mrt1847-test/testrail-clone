import { useEffect, useId, useRef, useState } from "react";

const toolbarButtonClass =
  "rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm hover:from-slate-50 hover:to-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

const toolbarButtonActiveClass =
  "rounded border border-slate-600 bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-inner";

export type CaseToolbarMenuItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  onSelect?: () => void;
};

type CaseToolbarMenuProps = {
  label: string;
  items: CaseToolbarMenuItem[];
  active?: boolean;
  disabled?: boolean;
  align?: "left" | "right";
};

export function CaseToolbarMenu({ label, items, active = false, disabled = false, align = "left" }: CaseToolbarMenuProps) {
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={active || open ? toolbarButtonActiveClass : toolbarButtonClass}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="ml-0.5 text-[10px] text-slate-500" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={[
            "absolute z-30 mt-1 min-w-[240px] rounded-md border border-slate-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          ].join(" ")}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="block w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={() => {
                if (item.disabled) return;
                item.onSelect?.();
                setOpen(false);
              }}
            >
              <span className="font-medium">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{item.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
