import { NavLink, Outlet, useParams } from "react-router-dom";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 text-xs ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`;

export function ReportsLayout() {
  const { projectId = "" } = useParams();
  const base = `/projects/${projectId}/reports`;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <NavLink to={base} end className={linkCls}>
          Overview
        </NavLink>
        <NavLink to={`${base}/runs`} className={linkCls}>
          Run summary
        </NavLink>
        <NavLink to={`${base}/milestones`} className={linkCls}>
          Milestones
        </NavLink>
        <NavLink to={`${base}/plans`} className={linkCls}>
          Plans
        </NavLink>
        <NavLink to={`${base}/traceability`} className={linkCls}>
          Traceability
        </NavLink>
        <NavLink to={`${base}/coverage`} className={linkCls}>
          Coverage gap
        </NavLink>
        <NavLink to={`${base}/defects`} className={linkCls}>
          Defect coverage
        </NavLink>
        <NavLink to={`${base}/explorer`} className={linkCls}>
          Results explorer
        </NavLink>
        <NavLink to={`${base}/saved`} className={linkCls}>
          Saved & exports
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
