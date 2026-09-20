import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "./Button";
import type { ButtonSize, ButtonVariant } from "./buttonStyles";
import { rememberModalRestoreTarget } from "./modalFocus";

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

export type OverflowMenuHandle = {
  open: () => void;
  close: (restoreFocus?: boolean) => void;
};

type Props = {
  label?: string;
  groups: OverflowMenuGroup[];
  align?: "left" | "right";
  size?: ButtonSize;
  variant?: ButtonVariant;
  iconOnly?: boolean;
  compact?: boolean;
  triggerClassName?: string;
  triggerTabIndex?: number;
  menuMark?: "ellipsis" | "chevron" | "none";
  triggerContent?: ReactNode;
  title?: string;
  disabled?: boolean;
};

export const OverflowMenu = forwardRef<OverflowMenuHandle, Props>(function OverflowMenu(
  {
    label = "More actions",
    groups,
    align = "right",
    size = "md",
    variant = "secondary",
    iconOnly = false,
    compact = false,
    triggerClassName,
    triggerTabIndex,
    menuMark = "ellipsis",
    triggerContent,
    title,
    disabled = false
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement>>([]);
  const menuId = useId();
  const showSelectionMarks = groups.some((group) => group.items.some((item) => item.selected !== undefined));

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      itemRefs.current = [];
      setOpen(true);
    },
    close
  }));

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

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = itemRefs.current.filter((item) => !item.hasAttribute("disabled"));
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
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
    <span className={showSelectionMarks ? "grid grid-cols-[1rem_minmax(0,1fr)] gap-2" : "block"}>
      {showSelectionMarks ? (
        <span aria-hidden="true" className="text-center font-semibold text-slate-700">
          {item.selected === true ? "✓" : ""}
        </span>
      ) : null}
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
        variant={variant}
        size={size}
        tabIndex={triggerTabIndex}
        className={triggerClassName}
        title={title}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          itemRefs.current = [];
          setOpen((value) => !value);
        }}
      >
        {iconOnly ? null : (triggerContent ?? label)}
        {menuMark === "none" ? null : (
          <span aria-hidden="true" className={iconOnly ? undefined : "text-slate-500"}>
            {menuMark === "chevron" ? "▾" : "•••"}
          </span>
        )}
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={[
            "absolute z-40 mt-2 max-h-[min(70vh,560px)] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl",
            compact ? "w-56 p-1" : "w-[min(340px,calc(100vw-2rem))] p-2",
            align === "right" ? "right-0" : "left-0"
          ].join(" ")}
        >
          {groups.map((group, groupIndex) => (
            <section
              key={group.id}
              aria-labelledby={group.label ? `${menuId}-${group.id}` : undefined}
              className={groupIndex > 0 ? "mt-2 border-t border-slate-200 pt-2" : undefined}
            >
              {group.label ? (
                <h3
                  id={`${menuId}-${group.id}`}
                  className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  {group.label}
                </h3>
              ) : null}
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
                      rememberModalRestoreTarget(triggerRef.current);
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
});
