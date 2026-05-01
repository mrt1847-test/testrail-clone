import { NavLink } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
  ].join(" ");

type ProjectTabsProps = {
  projectId: string;
};

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const base = `/projects/${projectId}`;

  return (
    <nav className="border-b border-slate-200 bg-white px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1">
        <NavLink to={base} end className={tabClass}>
          Overview
        </NavLink>
        <NavLink to={`${base}/cases`} className={tabClass}>
          Test Cases
        </NavLink>
        <NavLink to={`${base}/runs`} className={tabClass}>
          Test Runs
        </NavLink>
        <NavLink to={`${base}/my-tests`} className={tabClass}>
          My Tests
        </NavLink>
        <NavLink to={`${base}/results`} className={tabClass}>
          Results
        </NavLink>
        <NavLink to={`${base}/reports`} className={tabClass}>
          Reports
        </NavLink>
        <NavLink to={`${base}/activity`} className={tabClass}>
          Activity
        </NavLink>
        <NavLink to={`${base}/automation`} className={tabClass}>
          Automation
        </NavLink>
        <NavLink to={`${base}/import-export`} className={tabClass}>
          Import/Export
        </NavLink>
        <NavLink to={`${base}/milestones`} className={tabClass}>
          Milestones
        </NavLink>
        <NavLink to={`${base}/plans`} className={tabClass}>
          Plans
        </NavLink>
        <NavLink to={`${base}/settings`} className={tabClass}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
