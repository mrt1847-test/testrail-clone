import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

import {
  openEntityInNewTab,
  type EntityContextTarget
} from "../../features/projects/utils/openEntityInNewTab";
import { formatEntityDisplayId } from "../../features/projects/utils/entityShare";
import type { EntityJumpKind } from "../../features/projects/utils/entityJump";

export type EntityContextMenuState = EntityContextTarget & {
  x: number;
  y: number;
  caseCode?: string | null;
};

type EntityContextMenuContextValue = {
  openEntityContextMenu: (event: MouseEvent, target: Omit<EntityContextMenuState, "x" | "y">) => void;
};

const EntityContextMenuContext = createContext<EntityContextMenuContextValue | null>(null);

function EntityContextMenuPanel({
  state,
  onClose
}: {
  state: EntityContextMenuState;
  onClose: () => void;
}) {
  const label = formatEntityDisplayId(state.kind, state.entityId, { caseCode: state.caseCode });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: globalThis.MouseEvent) {
      const target = event.target;
      if (target instanceof Node && document.getElementById("entity-context-menu")?.contains(target)) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const maxX = typeof window !== "undefined" ? window.innerWidth - 220 : state.x;
  const maxY = typeof window !== "undefined" ? window.innerHeight - 80 : state.y;

  return createPortal(
    <div
      id="entity-context-menu"
      role="menu"
      className="fixed z-[70] min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left: Math.min(state.x, maxX), top: Math.min(state.y, maxY) }}
    >
      <p className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-800">
        {label}
      </p>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
        onClick={() => {
          openEntityInNewTab(state);
          onClose();
        }}
      >
        Open in new tab
      </button>
    </div>,
    document.body
  );
}

export function EntityContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EntityContextMenuState | null>(null);

  const openEntityContextMenu = useCallback(
    (event: MouseEvent, target: Omit<EntityContextMenuState, "x" | "y">) => {
      event.preventDefault();
      event.stopPropagation();
      setState({ ...target, x: event.clientX, y: event.clientY });
    },
    []
  );

  return (
    <EntityContextMenuContext.Provider value={{ openEntityContextMenu }}>
      {children}
      {state ? <EntityContextMenuPanel state={state} onClose={() => setState(null)} /> : null}
    </EntityContextMenuContext.Provider>
  );
}

export function useEntityContextMenu() {
  const ctx = useContext(EntityContextMenuContext);
  if (!ctx) {
    throw new Error("useEntityContextMenu must be used within EntityContextMenuProvider");
  }
  return ctx;
}

/** Optional hook for surfaces outside the project layout provider. */
export function useEntityContextMenuHandler(target: EntityContextTarget & { caseCode?: string | null }) {
  const [state, setState] = useState<EntityContextMenuState | null>(null);

  const onContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setState({ ...target, x: event.clientX, y: event.clientY });
    },
    [target.projectId, target.kind, target.entityId, target.sectionId, target.caseCode]
  );

  const menu = state ? <EntityContextMenuPanel state={state} onClose={() => setState(null)} /> : null;

  return { onContextMenu, menu };
}
