import { Link, useLocation } from "react-router-dom";

const LABELS: Record<string, string> = {
  projects: "Projects",
  cases: "Test Cases",
  runs: "Test Runs",
  new: "New",
  reports: "Reports",
  automation: "Automation",
  settings: "Settings",
  tokens: "API Tokens",
};

type BreadcrumbProps = {
  /** `/projects/:projectId/...` 에서 두 번째 세그먼트 라벨을 프로젝트 이름으로 바꿀 때 사용 */
  projectId?: string;
  projectName?: string;
};

export function Breadcrumb({ projectId, projectName }: BreadcrumbProps) {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs: { to: string; label: string }[] = [];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const seg = parts[i] ?? "";
    let label: string;
    if (seg === "projects" && i === 0) {
      label = "Projects";
    } else if (projectId && projectName && seg === projectId) {
      label = projectName;
    } else {
      label = LABELS[seg] ?? seg;
    }
    crumbs.push({ to: acc, label });
  }

  if (crumbs.length === 0) return null;

  return (
    <div className="border-b border-slate-100 bg-white px-4 py-2 text-sm text-slate-600">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-1">
        {crumbs.map((c, idx) => (
          <span key={c.to} className="flex items-center gap-1">
            {idx > 0 ? <span className="text-slate-400">/</span> : null}
            {idx === crumbs.length - 1 ? (
              <span className="font-medium text-slate-900">{c.label}</span>
            ) : (
              <Link to={c.to} className="hover:text-slate-900 hover:underline">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
