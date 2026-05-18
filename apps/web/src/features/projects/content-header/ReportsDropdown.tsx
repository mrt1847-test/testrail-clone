import { Link } from "react-router-dom";

import { HeaderDropdown, type HeaderDropdownItem } from "./HeaderDropdown";
import { reportMenuItems, type ContentHeaderReportContext } from "./contentHeaderReportMenus";

type Props = {
  projectId: string;
  context: ContentHeaderReportContext;
  suiteId?: string;
  runId?: string;
};

export function ReportsDropdown({ projectId, context, suiteId, runId }: Props) {
  const items: HeaderDropdownItem[] = reportMenuItems(projectId, context, { suiteId, runId }).map((row, index) => ({
    id: `report-${index}`,
    label: row.label,
    href: row.href,
    description: row.description
  }));

  items.push({
    id: "reports-hub",
    label: "All reports",
    href: `/projects/${projectId}/reports`,
    description: "Open the reports catalog"
  });

  return (
    <HeaderDropdown
      label="Reports"
      items={items}
      footer={
        <Link to={`/projects/${projectId}/reports`} className="text-xs font-medium text-blue-700 hover:underline">
          Browse report templates
        </Link>
      }
    />
  );
}
