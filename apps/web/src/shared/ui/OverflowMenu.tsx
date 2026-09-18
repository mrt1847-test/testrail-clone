import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "./Button";

export type OverflowMenuItem = {
  id: string;
  label: string;
  description?: string;
  to?: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  selected?: boolean;
  tone?: "default" | "danger";
  onSelect?: () => void;
};

export type OverflowMenuGroup = {
  id: string;
  label: string;
  items: OverflowMenuItem[];
};

type Props = {
  label?: string;
  groups: OverflowMenuGroup[];
  align?: "left" | "right";
};

export function OverflowMenu({ label = "More actions", groups, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const focusFirstItem = window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.cancelAnimationFrame(focusFirstItem);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = itemRefs.current.filter((item) => !item.hasAttribute("disabled"));
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabledItems.length - 1
          : event.key === "ArrowUp"
            ? (currentIndex - 1 + enabledItems.length) % enabledItems.length
            : (currentIndex + 1) % enabledItems.length;
    enabledItems[nextIndex]?.focus();
  };

  const setItemRef = (element: HTMLElement | null) => {
    if (element && !itemRefs.current.includes(element)) itemRefs.current.push(element);
  };

  const itemClassName = (item: OverflowMenuItem) =>
    [
      "block w-full rounded px-3 py-2 text-left text-sm outline-none transition-colors",
      item.tone === "danger"
        ? "text-red-700 hover:bg-red-50 focus-visible:bg-red-50"
        : "text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100",
      item.disabled ? "cursor-not-allowed opacity-45" : ""
    ]
      .filter(Boolean)
      .join(" ");

  const content = (item: OverflowMenuItem) => (
    <span className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
      <span aria-hidden="true" className="text-center font-semibold text-slate-700">
        {item.selected === true ? "✓" : ""}
      </span>
      <span>
        <span className="block font-medium">{item.label}</span>
        {item.description ? <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span> : null}
      </span>
    </span>
  );

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="md"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          itemRefs.current = [];
          setOpen((value) => !value);
        }}
      >
        {label}
        <span aria-hidden="true" className="text-slate-500">
          •••
        </span>
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={[
            "absolute z-40 mt-2 max-h-[min(70vh,560px)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl",
            align === "right" ? "right-0" : "left-0"
          ].join(" ")}
        >
          {groups.map((group, groupIndex) => (
            <section
              key={group.id}
              aria-labelledby={`${menuId}-${group.id}`}
              className={groupIndex > 0 ? "mt-2 border-t border-slate-200 pt-2" : undefined}
            >
              <h3
                id={`${menuId}-${group.id}`}
                className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
              >
                {group.label}
              </h3>
              {group.items.map((item) => {
                const itemRole = item.selected === undefined ? "menuitem" : "menuitemcheckbox";
                const commonProps = {
                  role: itemRole,
                  ...(item.selected === undefined ? {} : { "aria-checked": item.selected }),
                  className: itemClassName(item),
                  onClick: () => close()
                } as const;
                if (item.to && !item.disabled) {
                  return (
                    <Link key={item.id} ref={setItemRef} to={item.to} {...commonProps}>
                      {content(item)}
                    </Link>
                  );
                }
                if (item.href && !item.disabled) {
                  return (
                    <a
                      key={item.id}
                      ref={setItemRef}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      {...commonProps}
                    >
                      {content(item)}
                    </a>
                  );
                }
                return (
                  <button
                    key={item.id}
                    ref={setItemRef}
                    type="button"
                    role={itemRole}
                    aria-checked={item.selected === undefined ? undefined : item.selected}
                    className={itemClassName(item)}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect?.();
                      close();
                    }}
                  >
                    {content(item)}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
