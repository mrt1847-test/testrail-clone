import { Link } from "react-router-dom";

type Props = {
  projectId: string;
  planId: string;
  planName: string;
  runName: string;
};

export function RunPlanBreadcrumb({ projectId, planId, planName, runName }: Props) {
  return (
    <nav className="mb-2 text-xs text-slate-600" aria-label="Breadcrumb">
      <Link
        to={`/projects/${projectId}/plans/${planId}`}
        className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
      >
        {planName}
      </Link>
      <span className="mx-1.5 text-slate-400" aria-hidden>
        /
      </span>
      <span className="text-slate-800">{runName}</span>
    </nav>
  );
}
