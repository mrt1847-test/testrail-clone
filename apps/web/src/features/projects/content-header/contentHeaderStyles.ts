import { buttonClassName } from "../../../shared/ui/buttonStyles";

export const contentHeaderActionClass = buttonClassName({ variant: "secondary", size: "sm" });

export const contentHeaderPrimaryClass =
  "inline-flex items-center rounded border border-blue-800 bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800";

export const contentHeaderDisabledClass =
  "inline-flex cursor-not-allowed items-center rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-400";
