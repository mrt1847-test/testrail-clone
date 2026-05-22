import { useState } from "react";

import { downloadRunResultsCsv, downloadRunTestsCsv } from "../../projects/api/importExportApi";
import { HeaderDropdown, type HeaderDropdownItem } from "../../projects/content-header/HeaderDropdown";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { EntityCopyActions } from "../../../shared/ui/EntityCopyActions";
import { contentHeaderActionClass } from "../../projects/content-header/contentHeaderStyles";

type ExportProps = {
  projectId: string;
  runId: string;
  suiteId?: string;
};

export function RunExportDropdown({ projectId, runId, suiteId }: ExportProps) {
  const [exportBusy, setExportBusy] = useState(false);
  const items: HeaderDropdownItem[] = [
    {
      id: "print",
      label: "Print view",
      description: "Printer-friendly run summary",
      href: `/projects/${projectId}/runs/${runId}/print`
    },
    {
      id: "run-tests-csv",
      label: "Export tests (CSV)",
      description: "Current test list with status and assignee",
      disabled: exportBusy,
      onSelect: () => {
        setExportBusy(true);
        void downloadRunTestsCsv(projectId, runId).finally(() => setExportBusy(false));
      }
    },
    {
      id: "run-results-csv",
      label: "Export results (CSV)",
      description: "All submitted results in this run",
      disabled: exportBusy,
      onSelect: () => {
        setExportBusy(true);
        void downloadRunResultsCsv(projectId, runId).finally(() => setExportBusy(false));
      }
    }
  ];
  if (suiteId) {
    items.splice(1, 0, {
      id: "suite-csv",
      label: "Export suite (CSV)",
      description: "Case repository export for this suite",
      href: `/projects/${projectId}/import-export?kind=export&suiteId=${encodeURIComponent(suiteId)}`
    });
  }

  return <HeaderDropdown label="Export" items={items} />;
}

type SubscribeProps = {
  subscribedCount: number;
  totalTests: number;
  onScrollToTests: () => void;
};

export function RunSubscribeDropdown({ subscribedCount, totalTests, onScrollToTests }: SubscribeProps) {
  const items: HeaderDropdownItem[] = [
    {
      id: "row-watch",
      label: "Watch tests in table",
      description: "Use the Watch control on each test row for email updates",
      onSelect: onScrollToTests
    }
  ];

  return (
    <HeaderDropdown
      label={subscribedCount > 0 ? `Subscribed (${subscribedCount})` : "Subscribe"}
      items={items}
      footer={
        <p className="text-[11px] text-slate-500">
          {subscribedCount} of {totalTests} tests watched. Run-wide subscribe is planned.
        </p>
      }
    />
  );
}

export function RunDetailHeaderSecondaryActions({
  projectId,
  runId,
  suiteId,
  subscribedCount,
  totalTests,
  onScrollToTests
}: ExportProps & SubscribeProps) {
  return (
    <>
      <EntityCopyActions projectId={projectId} kind="run" entityId={runId} compact />
      <RunSubscribeDropdown
        subscribedCount={subscribedCount}
        totalTests={totalTests}
        onScrollToTests={onScrollToTests}
      />
      <RunExportDropdown projectId={projectId} runId={runId} suiteId={suiteId} />
      <PrintLinkButton
        to={`/projects/${projectId}/runs/${runId}/print`}
        label="Print"
        className={contentHeaderActionClass}
      />
    </>
  );
}
