import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { fetchSuites } from "../../features/projects/api/suitesApi";
import { usePinnedProjects } from "../../features/projects/hooks/usePinnedProjects";
import type { ProjectSummary } from "../../features/projects/types";
import { partitionPinnedProjects } from "../../features/projects/utils/pinnedProjects";

type ProjectSwitcherProps = {
  projects: ProjectSummary[];
  currentProjectId: string;
};

function PinButton({
  pinned,
  label,
  onClick
}: {
  pinned: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] leading-none",
        pinned
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      ].join(" ")}
      title={pinned ? `Unpin ${label}` : `Pin ${label}`}
      aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
      aria-pressed={pinned}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}

function ProjectLink({
  project,
  currentProjectId,
  pinned,
  onTogglePin
}: {
  project: ProjectSummary;
  currentProjectId: string;
  pinned: boolean;
  onTogglePin: (projectId: string) => void;
}) {
  const active = project.id === currentProjectId;
  return (
    <span className="inline-flex items-center">
      <Link
        to={`/projects/${project.id}`}
        className={
          active
            ? "rounded-md bg-slate-900 px-2 py-0.5 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            : "rounded-md px-2 py-0.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        }
      >
        {project.name}
      </Link>
      <PinButton pinned={pinned} label={project.name} onClick={() => onTogglePin(project.id)} />
    </span>
  );
}

export function ProjectSwitcher({ projects, currentProjectId }: ProjectSwitcherProps) {
  const { pinnedProjectIds, toggleProjectPin, pinDefaultSuite, pinnedSuiteFor, isProjectPinned } =
    usePinnedProjects();
  const { pinned, others } = partitionPinnedProjects(projects, pinnedProjectIds);

  const suitesQuery = useQuery({
    queryKey: ["project-switcher-suites", currentProjectId],
    queryFn: () => fetchSuites(currentProjectId),
    enabled: Boolean(currentProjectId)
  });

  const suites = suitesQuery.data ?? [];
  const pinnedSuiteId = pinnedSuiteFor(currentProjectId);
  const pinnedSuiteName = suites.find((suite) => suite.id === pinnedSuiteId)?.name;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 text-slate-500 dark:text-slate-400">Switch:</span>
        {pinned.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Pinned
            </span>
            {pinned.map((project) => (
              <ProjectLink
                key={project.id}
                project={project}
                currentProjectId={currentProjectId}
                pinned={isProjectPinned(project.id)}
                onTogglePin={toggleProjectPin}
              />
            ))}
          </div>
        ) : null}
        {others.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {pinned.length > 0 ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">All</span>
            ) : null}
            {others.map((project) => (
              <ProjectLink
                key={project.id}
                project={project}
                currentProjectId={currentProjectId}
                pinned={isProjectPinned(project.id)}
                onTogglePin={toggleProjectPin}
              />
            ))}
          </div>
        ) : null}
        <Link
          to="/projects"
          className="rounded-md px-2 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
        >
          All projects
        </Link>
      </div>

      {currentProjectId && suites.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <label className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500">Default suite</span>
            <select
              className="max-w-[12rem] rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800"
              value={pinnedSuiteId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                pinDefaultSuite(currentProjectId, value || null);
              }}
            >
              <option value="">None pinned</option>
              {suites.map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                </option>
              ))}
            </select>
          </label>
          {pinnedSuiteName ? (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              Pinned: {pinnedSuiteName} (used when opening Test Cases)
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">Pin a suite for this project in the case repository.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
