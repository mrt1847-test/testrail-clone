import { useEffect } from "react";

type Input = {
  enabled: boolean;
  onShowHelp: () => void;
  onNextTest: () => void;
  onPrevTest: () => void;
  onNextFailed: () => void;
  onNextBlocked: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useRunKeyboardShortcuts(input: Input) {
  const { enabled, onShowHelp, onNextTest, onPrevTest, onNextFailed, onNextBlocked } = input;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      if (key === "?") {
        event.preventDefault();
        onShowHelp();
        return;
      }
      if (key === "j" || key === "arrowdown") {
        event.preventDefault();
        onNextTest();
        return;
      }
      if (key === "k" || key === "arrowup") {
        event.preventDefault();
        onPrevTest();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        onNextFailed();
        return;
      }
      if (key === "b") {
        event.preventDefault();
        onNextBlocked();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onNextBlocked, onNextFailed, onNextTest, onPrevTest, onShowHelp]);
}

export const RUN_DETAIL_SHORTCUTS = [
  { keys: ["?"], description: "Show shortcuts" },
  { keys: ["J"], description: "Next test" },
  { keys: ["K"], description: "Previous test" },
  { keys: ["F"], description: "Next failed test" },
  { keys: ["B"], description: "Next blocked test" }
] as const;
