import { useEffect } from "react";

type Input = {
  enabled: boolean;
  caseIds: number[];
  activeCaseId: number | null;
  onFocusCase: (caseId: number) => void;
  onTogglePanel: (caseId: number) => void;
  onClosePanel: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useCaseListKeyboardNav({
  enabled,
  caseIds,
  activeCaseId,
  onFocusCase,
  onTogglePanel,
  onClosePanel
}: Input) {
  useEffect(() => {
    if (!enabled || caseIds.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const currentIndex =
        activeCaseId != null ? caseIds.findIndex((id) => id === activeCaseId) : -1;

      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, caseIds.length - 1);
        onFocusCase(caseIds[nextIndex]!);
        return;
      }

      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? caseIds.length - 1 : Math.max(currentIndex - 1, 0);
        onFocusCase(caseIds[nextIndex]!);
        return;
      }

      if (event.key === "q" || event.key === "Q") {
        event.preventDefault();
        const targetId = activeCaseId ?? caseIds[0];
        if (targetId != null) onTogglePanel(targetId);
        return;
      }

      if (event.key === "Escape") {
        onClosePanel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCaseId, caseIds, enabled, onClosePanel, onFocusCase, onTogglePanel]);
}
