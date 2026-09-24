import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  decideUnsavedLeave,
  discardedBrowserBackDelta,
  shouldInterceptInAppAnchorNavigation,
  shouldWarnBeforeUnload
} from "../utils/unsavedDraftGuard";

type PendingAction = () => void;

export type UnsavedDraftGuard = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLeaveHint: (hint: string | null) => void;
  leaveHint: string | null;
  requestLeave: (action: PendingAction) => void;
  confirmOpen: boolean;
  keepEditing: () => void;
  discardAndLeave: () => void;
};

/**
 * Shared leave protection for dirty case authoring/editing.
 * Blocks SPA link clicks and refresh/tab close while dirty; queues one pending navigation.
 */
export function useUnsavedDraftGuard(initialDirty = false): UnsavedDraftGuard {
  const navigate = useNavigate();
  const dirtyRef = useRef(initialDirty);
  const savingRef = useRef(false);
  const [isDirty, setIsDirty] = useState(initialDirty);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveHint, setLeaveHint] = useState<string | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    setIsDirty(dirty);
    if (!dirty) {
      pendingRef.current = null;
      setConfirmOpen(false);
    }
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    savingRef.current = saving;
  }, []);

  const keepEditing = useCallback(() => {
    pendingRef.current = null;
    setConfirmOpen(false);
  }, []);

  const discardAndLeave = useCallback(() => {
    const action = pendingRef.current;
    pendingRef.current = null;
    dirtyRef.current = false;
    setIsDirty(false);
    setConfirmOpen(false);
    setLeaveHint(null);
    action?.();
  }, []);

  const requestLeave = useCallback((action: PendingAction) => {
    const decision = decideUnsavedLeave({ dirty: dirtyRef.current, saving: savingRef.current });
    if (decision === "proceed") {
      action();
      return;
    }
    if (decision === "block-saving") return;
    pendingRef.current = action;
    setConfirmOpen(true);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeUnload({ dirty: dirtyRef.current, saving: savingRef.current })) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    const onDocumentClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const next = shouldInterceptInAppAnchorNavigation({
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        href: anchor.href,
        download: anchor.hasAttribute("download"),
        target: anchor.target,
        currentOrigin: window.location.origin,
        currentLocation: `${window.location.pathname}${window.location.search}${window.location.hash}`
      });
      if (next == null) return;
      event.preventDefault();
      event.stopPropagation();
      requestLeave(() => navigate(next));
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [isDirty, navigate, requestLeave]);

  useEffect(() => {
    if (!isDirty) return;
    const onPopState = () => {
      if (!dirtyRef.current) return;
      // Re-push the draft URL so React Router does not unmount the form.
      window.history.pushState(null, "", window.location.href);
      requestLeave(() => {
        dirtyRef.current = false;
        setIsDirty(false);
        window.history.go(discardedBrowserBackDelta());
      });
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty, requestLeave]);

  return useMemo(
    () => ({
      isDirty,
      setDirty,
      setSaving,
      setLeaveHint,
      leaveHint,
      requestLeave,
      confirmOpen,
      keepEditing,
      discardAndLeave
    }),
    [confirmOpen, discardAndLeave, isDirty, keepEditing, leaveHint, requestLeave, setDirty, setSaving]
  );
}
