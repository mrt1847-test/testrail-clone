import { useEffect, useMemo, useState } from "react";

import { Button, FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../../shared/ui";
import { Drawer } from "../../../../shared/ui/Drawer";
import type { ReportExportType } from "../../api/reportsApi";
import { REPORT_TYPE_LABELS } from "../../reports/reportRoutes";
import { reportTemplates, type ReportTemplate } from "../../reports/reportCatalog";

export type ReportAddDialogValues = {
  name: string;
  description: string;
  reportType: ReportExportType;
  optionValues: Record<string, string>;
  access: string;
};

type Props = {
  open: boolean;
  templates?: ReportTemplate[];
  initialType: ReportExportType;
  saving?: boolean;
  saveStatus?: SaveFeedbackStatus;
  saveError?: string;
  onCancel: () => void;
  onSubmit: (values: ReportAddDialogValues) => void;
};

const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export function ReportAddDialog({
  open,
  templates = reportTemplates,
  initialType,
  saving = false,
  saveStatus = "idle",
  saveError,
  onCancel,
  onSubmit
}: Props) {
  const [reportType, setReportType] = useState<ReportExportType>(initialType);
  const [name, setName] = useState(`${REPORT_TYPE_LABELS[initialType]} report`);
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState("project_team");
  const [optionValues, setOptionValues] = useState<Record<string, string>>({});

  const template = useMemo(
    () => templates.find((item) => item.type === reportType) ?? templates[0],
    [reportType, templates]
  );

  useEffect(() => {
    if (!open) return;
    const next = templates.find((item) => item.type === initialType) ?? templates[0];
    setReportType(next.type);
    setName(`${REPORT_TYPE_LABELS[next.type]} report`);
    setDescription("");
    setAccess("project_team");
    setOptionValues({});
  }, [initialType, open, templates]);

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title="Add report"
      subtitle="Save a named view. Open a template from the catalog to see results first."
      widthClassName="max-w-lg"
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <SaveFeedback
            className="mr-auto"
            status={saveStatus === "idle" && saving ? "saving" : saveStatus}
            message={saveStatus === "failed" ? saveError ?? "Could not save report." : undefined}
          />
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !name.trim()}
            loading={saving}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                description: description.trim(),
                reportType: template.type,
                optionValues,
                access
              })
            }
          >
            Save report
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <FormField label="Template" required>
          {(control) => (
            <select
              {...control}
              className={inputClass}
              value={template.type}
              onChange={(event) => {
                const next = event.target.value as ReportExportType;
                setReportType(next);
                setName(`${REPORT_TYPE_LABELS[next]} report`);
                setOptionValues({});
              }}
            >
              {templates.map((item) => (
                <option key={item.type} value={item.type}>
                  {REPORT_TYPE_LABELS[item.type]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="Name" required>
          {(control) => (
            <input
              {...control}
              className={inputClass}
              value={name}
              placeholder="e.g. Weekly run summary"
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Description">
          {(control) => (
            <textarea
              {...control}
              className={inputClass}
              rows={3}
              placeholder="Purpose or audience"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </FormField>
        {template.options.map((option) => (
          <FormField key={option.id} label={option.label}>
            {(control) => (
              <input
                {...control}
                className={inputClass}
                placeholder={option.placeholder}
                value={optionValues[option.id] ?? ""}
                onChange={(event) =>
                  setOptionValues((current) => ({ ...current, [option.id]: event.target.value }))
                }
              />
            )}
          </FormField>
        ))}
        <FormField label="Access">
          {(control) => (
            <select
              {...control}
              className={inputClass}
              value={access}
              onChange={(event) => setAccess(event.target.value)}
            >
              <option value="project_team">Project team</option>
              <option value="private">Only me</option>
            </select>
          )}
        </FormField>
      </div>
    </Drawer>
  );
}
