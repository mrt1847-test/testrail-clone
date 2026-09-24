import { createContext, useContext, type ReactNode } from "react";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { useUnsavedDraftGuard, type UnsavedDraftGuard } from "../hooks/useUnsavedDraftGuard";

const CaseDraftGuardContext = createContext<UnsavedDraftGuard | null>(null);

export function CaseDraftGuardProvider({
  children,
  title = "Discard unsaved changes?",
  description = "Your unsaved test case changes will be lost."
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const guard = useUnsavedDraftGuard(false);

  return (
    <CaseDraftGuardContext.Provider value={guard}>
      {children}
      <ConfirmDialog
        open={guard.confirmOpen}
        title={title}
        description={guard.leaveHint ?? description}
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={guard.keepEditing}
        onConfirm={guard.discardAndLeave}
      />
    </CaseDraftGuardContext.Provider>
  );
}

export function useCaseDraftGuard() {
  const value = useContext(CaseDraftGuardContext);
  if (!value) {
    throw new Error("useCaseDraftGuard requires CaseDraftGuardProvider");
  }
  return value;
}

export function useOptionalCaseDraftGuard() {
  return useContext(CaseDraftGuardContext);
}
