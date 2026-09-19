import { RunCaseInstructionBody } from "../../runs/components/RunCaseInstructionBody";
import { buildRunCaseInstructionModel } from "../../runs/utils/runCaseInstructionModel";
import type { CaseScenarioRow } from "../api/bddApi";
import type { TestCase } from "../types";
import { formatCustomFieldDisplayValue } from "../utils/formatCustomFieldValue";
import type { CaseAuthoringCustomFieldDefinition, CaseAuthoringTemplateDefinition } from "./CaseAuthoringForm";
import { CaseRefTokens } from "./CaseRefTokens";
import { instructionKindFromTemplateFields } from "../utils/caseAuthoringInstructions";

type Props = {
  data: TestCase;
  projectId?: string;
  sectionPath?: string | null;
  templateName?: string | null;
  templates?: CaseAuthoringTemplateDefinition[];
  customFields?: CaseAuthoringCustomFieldDefinition[];
  scenarios?: CaseScenarioRow[];
};

export function CaseInstructionReadView({
  data,
  projectId,
  sectionPath,
  templateName,
  templates = [],
  customFields = [],
  scenarios = []
}: Props) {
  const template = templates.find((row) => row.id === String(data.caseTemplateId ?? ""));
  const usesStructuredSteps = instructionKindFromTemplateFields(template?.fields) === "steps";
  const model = buildRunCaseInstructionModel(
    {
      preconditions: data.preconditions,
      expectedResult: data.expectedResult,
      steps: data.steps,
      mission: data.mission,
      goals: data.goals,
      aiInput: data.aiInput,
      aiExpectedOutput: data.aiExpectedOutput,
      scenarios
    },
    { usesStructuredSteps }
  );

  const populatedCustom = customFields
    .filter((field) => field.isActive)
    .map((field) => ({
      field,
      display: formatCustomFieldDisplayValue(data.customValues[field.systemName])
    }))
    .filter((row) => row.display.trim().length > 0);

  const estimate = data.estimate.trim();
  const references = data.references.trim();
  const automationKey = data.automationKey.trim();

  return (
    <div className="mt-3 space-y-4">
      {sectionPath ? (
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-600">Section</span> {sectionPath}
        </p>
      ) : null}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <div>
          <dt className="inline text-slate-500">Type </dt>
          <dd className="inline font-medium text-slate-800">{data.type}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Priority </dt>
          <dd className="inline font-medium text-slate-800">{data.priority}</dd>
        </div>
        {estimate && estimate !== "-" ? (
          <div>
            <dt className="inline text-slate-500">Estimate </dt>
            <dd className="inline font-medium text-slate-800">{estimate}</dd>
          </div>
        ) : null}
        {references ? (
          <div className="min-w-0">
            <dt className="inline text-slate-500">References </dt>
            <dd className="inline">
              <CaseRefTokens refsValue={data.references} projectId={projectId} />
            </dd>
          </div>
        ) : null}
        {templateName ? (
          <div>
            <dt className="inline text-slate-500">Template </dt>
            <dd className="inline font-medium text-slate-800">{templateName}</dd>
          </div>
        ) : null}
      </dl>

      {data.labels.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
          <span className="text-slate-500">Labels</span>
          {data.labels.map((label) => (
            <span key={label} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
              {label}
            </span>
          ))}
        </p>
      ) : null}

      {automationKey ? (
        <p className="text-xs text-slate-600">
          <span className="text-slate-500">Automation key </span>
          <span className="font-medium text-slate-800">{automationKey}</span>
        </p>
      ) : null}

      <RunCaseInstructionBody model={model} />

      {populatedCustom.length > 0 ? (
        <dl className="grid gap-1 text-sm text-slate-700">
          {populatedCustom.map(({ field, display }) => (
            <div key={field.systemName} className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="text-xs font-medium text-slate-500">{field.name}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words">{display}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
