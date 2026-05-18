import { useEffect } from "react";

type Input = {
  enabled: boolean;
  onAddCase?: () => void;
  onFocusNewSection?: () => void;
  onRunTest?: () => void;
  onEditSuiteDescription?: () => void;
  onAddDefect?: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useCaseRepositoryKeyboard({
  enabled,
  onAddCase,
  onFocusNewSection,
  onRunTest,
  onEditSuiteDescription,
  onAddDefect
}: Input) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "c" && onAddCase) {
        event.preventDefault();
        onAddCase();
        return;
      }
      if (key === "s" && onFocusNewSection) {
        event.preventDefault();
        onFocusNewSection();
        return;
      }
      if (key === "r" && onRunTest) {
        event.preventDefault();
        onRunTest();
        return;
      }
      if (key === "e" && onEditSuiteDescription) {
        event.preventDefault();
        onEditSuiteDescription();
        return;
      }
      if (key === "d" && onAddDefect) {
        event.preventDefault();
        onAddDefect();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onAddCase, onAddDefect, onEditSuiteDescription, onFocusNewSection, onRunTest]);
}
