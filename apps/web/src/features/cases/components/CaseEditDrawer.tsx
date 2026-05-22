import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { Drawer } from "../../../shared/ui/Drawer";

type CaseEditDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function CaseEditDrawer({ open, title, onClose, children }: CaseEditDrawerProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <Drawer
      open={open}
      title="Edit test case"
      subtitle={title}
      onClose={onClose}
      widthClassName="max-w-3xl"
    >
      {children}
    </Drawer>,
    document.body
  );
}
