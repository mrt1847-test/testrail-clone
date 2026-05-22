import type { ReactNode } from "react";

type AppShellProps = {
  /** 상단 영역: 브랜드, 프로젝트 헤더, 탭, 브레드크럼 등 */
  top: ReactNode;
  children: ReactNode;
};

export function AppShell({ top, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {top}
      <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}
