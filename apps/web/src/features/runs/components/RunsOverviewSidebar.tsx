import { Link } from "react-router-dom";

import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import { contentHeaderPrimaryClass } from "../../projects/content-header/contentHeaderStyles";
import { buildRunComparisonPath } from "../utils/runComparisonUrl";

type RunsOverviewSidebarProps = {
  projectId: string;
  openCount: number;
  completedCount: number;
  orderBy: "date" | "name";
  onOrderByChange: (value: "date" | "name") => void;
  onAddRun: () => void;
};

export function RunsOverviewSidebar({
  projectId,
  openCount,
  completedCount,
  orderBy,
  onOrderByChange,
  onAddRun
}: RunsOverviewSidebarProps) {
  return (
    <aside className="w-full shrink-0 space-y-3 lg:w-56">
      <div className={`${density.sidebarPanel} dark:border-slate-700 dark:bg-slate-900`}>
        <div className="space-y-2">
          <button type="button" onClick={onAddRun} className={`w-full ${contentHeaderPrimaryClass}`}>
            Add Test Run
          </button>
          <Link
            to={`/projects/${projectId}/plans`}
            className="block w-full rounded border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Add Test Plan
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">{openCount}</span> open and{" "}
          <span className="font-medium text-slate-900 dark:text-slate-100">{completedCount}</span> completed test
          runs and plans
        </p>
      </div>

      <div className={`${density.sidebarPanel} dark:border-slate-700 dark:bg-slate-900`}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Order by</label>
        <select
          className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={orderBy}
          onChange={(e) => onOrderByChange(e.target.value as "date" | "name")}
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div className={`${density.sidebarPanel} text-sm dark:border-slate-700 dark:bg-slate-900`}>
        <Link
          to={buildRunComparisonPath(projectId)}
          className="font-medium text-indigo-800 hover:underline dark:text-indigo-300"
        >
          Compare runs
        </Link>
      </div>
    </aside>
  );
}
