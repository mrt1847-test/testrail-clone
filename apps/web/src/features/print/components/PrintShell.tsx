import type { ReactNode } from "react";

type PrintShellProps = {
  backHref: string;
  backLabel?: string;
  onDownloadHtml?: () => void;
  children: ReactNode;
};

export function PrintShell({ backHref, backLabel = "Back", onDownloadHtml, children }: PrintShellProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="print-hide sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <a href={backHref} className="text-sm font-medium text-indigo-800 hover:underline">
          ← {backLabel}
        </a>
        <div className="flex flex-wrap items-center gap-2">
          {onDownloadHtml ? (
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onDownloadHtml}
            >
              Download HTML
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </header>
      {children}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          .print-document { max-width: none; padding: 0; }
        }
      `}</style>
    </div>
  );
}
