export type ProjectNavTab = {
  label: string;
  to: string;
  end?: boolean;
  group: "primary" | "secondary";
  alsoMatch?: string[];
};

export function buildProjectNavTabs(projectId: string): ProjectNavTab[] {
  const base = `/projects/${projectId}`;
  return [
    { label: "Overview", to: base, end: true, group: "primary" },
    { label: "Test Cases", to: `${base}/cases`, group: "primary" },
    {
      label: "Test Runs & Results",
      to: `${base}/runs`,
      group: "primary",
      alsoMatch: [`${base}/plans`]
    },
    { label: "Milestones", to: `${base}/milestones`, group: "primary" },
    { label: "Reports", to: `${base}/reports`, group: "primary" },
    { label: "My Tests", to: `${base}/my-tests`, group: "primary" },
    { label: "Settings", to: `${base}/settings`, group: "primary" },
    { label: "Test Plans", to: `${base}/plans`, group: "secondary" },
    { label: "Team Todo", to: `${base}/team-todo`, group: "secondary" },
    { label: "Result Explorer", to: `${base}/results`, group: "secondary" },
    { label: "Activity", to: `${base}/activity`, group: "secondary" },
    { label: "Automation", to: `${base}/automation`, group: "secondary" },
    { label: "Import/Export", to: `${base}/import-export`, group: "secondary" },
    { label: "Shared Steps", to: `${base}/shared-steps`, group: "secondary" }
  ];
}

export function matchesProjectNavTab(
  pathname: string,
  to: string,
  end = false,
  alsoMatch: string[] = []
) {
  const prefixes = [to, ...alsoMatch];
  return prefixes.some((prefix) =>
    end ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function currentProjectNavTab(pathname: string, tabs: ProjectNavTab[]) {
  return (
    tabs
      .filter((tab) => matchesProjectNavTab(pathname, tab.to, tab.end, tab.alsoMatch))
      .sort((left, right) => {
        if (left.group !== right.group) return left.group === "primary" ? -1 : 1;
        return right.to.length - left.to.length;
      })[0] ?? null
  );
}

export function projectNavLocationLabel(tab: ProjectNavTab | null) {
  return tab ? `Go to: ${tab.label}` : "Go to";
}
