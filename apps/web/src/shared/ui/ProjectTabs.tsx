import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import { OverflowMenu } from "./OverflowMenu";
import {
  buildProjectNavTabs,
  currentProjectNavTab,
  projectNavLocationLabel,
  type ProjectNavTab
} from "./projectNavTabs";

type ProjectTabsProps = {
  projectId: string;
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  ].join(" ");

function toMenuItems(tabs: ProjectNavTab[], activeTo: string | undefined) {
  return tabs.map((tab) => ({
    id: tab.to,
    label: tab.label,
    selected: tab.to === activeTo,
    to: tab.to
  }));
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const location = useLocation();
  const tabs = useMemo(() => buildProjectNavTabs(projectId), [projectId]);
  const primaryTabs = useMemo(() => tabs.filter((tab) => tab.group === "primary"), [tabs]);
  const secondaryTabs = useMemo(() => tabs.filter((tab) => tab.group === "secondary"), [tabs]);
  const activeTab = currentProjectNavTab(location.pathname, tabs);
  const moreLabel = activeTab?.group === "secondary" ? `More: ${activeTab.label}` : "More";

  return (
    <nav className="shell-bar border-b px-4 py-1" aria-label="Project">
      <div className="mx-auto flex max-w-[90rem] min-w-0 items-center justify-between gap-2">
        <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex">
          {primaryTabs.map((tab) => {
            const isActive = activeTab?.to === tab.to && activeTab.group === "primary";
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={isActive ? "page" : undefined}
                className={navLinkClass({ isActive })}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden shrink-0 sm:block">
          <OverflowMenu
            label={moreLabel}
            size="sm"
            align="right"
            groups={[
              {
                id: "additional",
                label: "Additional views",
                items: toMenuItems(secondaryTabs, activeTab?.to)
              }
            ]}
          />
        </div>

        <div className="sm:hidden">
          <OverflowMenu
            label={projectNavLocationLabel(activeTab)}
            size="sm"
            align="left"
            groups={[
              {
                id: "primary",
                label: "Project",
                items: toMenuItems(primaryTabs, activeTab?.to)
              },
              {
                id: "additional",
                label: "Additional views",
                items: toMenuItems(secondaryTabs, activeTab?.to)
              }
            ]}
          />
        </div>
      </div>
    </nav>
  );
}
