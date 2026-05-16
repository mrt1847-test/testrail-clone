import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

type ProjectTabsProps = {
  projectId: string;
};

type TabSpec = {
  label: string;
  to: string;
  end?: boolean;
};

function matchesTab(pathname: string, to: string, end = false) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  ].join(" ");

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const base = `/projects/${projectId}`;

  const primaryTabs = useMemo<TabSpec[]>(
    () => [
      { label: "Overview", to: base, end: true },
      { label: "Test Cases", to: `${base}/cases` },
      { label: "Test Runs", to: `${base}/runs` },
      { label: "My Tests", to: `${base}/my-tests` },
      { label: "Plans", to: `${base}/plans` },
      { label: "Milestones", to: `${base}/milestones` },
      { label: "Results", to: `${base}/results` },
      { label: "Reports", to: `${base}/reports` }
    ],
    [base]
  );

  const secondaryTabs = useMemo<TabSpec[]>(
    () => [
      { label: "Activity", to: `${base}/activity` },
      { label: "Automation", to: `${base}/automation` },
      { label: "Import/Export", to: `${base}/import-export` },
      { label: "Settings", to: `${base}/settings` }
    ],
    [base]
  );

  const activeSecondaryTab =
    secondaryTabs.find((tab) => matchesTab(location.pathname, tab.to, tab.end)) ?? null;

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <nav className="border-b border-slate-200 bg-white px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {primaryTabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={navLinkClass}>
              {tab.label}
            </NavLink>
          ))}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((current) => !current)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activeSecondaryTab || moreOpen
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            ].join(" ")}
          >
            More
            {activeSecondaryTab ? ` · ${activeSecondaryTab.label}` : ""}
          </button>

          {moreOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Secondary Views
                </p>
              </div>
              <div className="grid p-2">
                {secondaryTabs.map((tab) => {
                  const active = matchesTab(location.pathname, tab.to, tab.end);
                  return (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      end={tab.end}
                      className={[
                        "rounded-xl px-3 py-2 text-sm transition-colors",
                        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                      ].join(" ")}
                    >
                      {tab.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
