import { Link } from "react-router-dom";

import { LoadingState } from "../../../shared/ui/LoadingState";
import type { CaseScenarioRow } from "../../cases/api/bddApi";
import { CaseRefTokens } from "../../cases/components/CaseRefTokens";
import { buildCaseDetailPath } from "../../cases/caseRoute";
import type { TestCase } from "../../cases/types";

type Props = {
  projectId: string;
  caseId: string;
  caseCode: string;
  title: string;
  data: TestCase | undefined;
  scenarios?: CaseScenarioRow[];
  isLoading: boolean;
  isError?: boolean;
};

function TextBlock({ label, value }: { label: string; value: string }) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{trimmed}</p>
    </div>
  );
}

export function RunCaseContextPanel({
  projectId,
  caseId,
  caseCode,
  title,
  data,
  scenarios = [],
  isLoading,
  isError = false
}: Props) {
  if (isLoading) {
    return <LoadingState message="Loading case…" />;
  }

  if (isError || !data) {
    return <p className="text-sm text-slate-500">Could not load case details.</p>;
  }

  const steps = [...(data.steps ?? [])].sort(
    (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
  );
  const hasExploratory = Boolean(data.mission?.trim() || data.goals?.trim());
  const hasAi = Boolean(data.aiInput?.trim() || data.aiExpectedOutput?.trim());

  return (
    <div className="space-y-3 border-b border-slate-200 pb-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{caseCode}</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{title}</h3>
        </div>
        <Link
          to={buildCaseDetailPath(projectId, Number(caseId))}
          className="shrink-0 text-xs font-medium text-indigo-800 hover:underline"
        >
          Open case
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="font-medium text-slate-800">{data.type}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Priority</dt>
          <dd className="font-medium text-slate-800">{data.priority}</dd>
        </div>
        {data.estimate?.trim() ? (
          <div>
            <dt className="text-slate-500">Estimate</dt>
            <dd className="font-medium text-slate-800">{data.estimate}</dd>
          </div>
        ) : null}
      </dl>

      <TextBlock label="Preconditions" value={data.preconditions} />

      {hasExploratory ? (
        <div className="space-y-2 rounded border border-violet-100 bg-violet-50/50 p-2">
          <TextBlock label="Mission" value={data.mission} />
          <TextBlock label="Goals" value={data.goals} />
        </div>
      ) : null}

      {hasAi ? (
        <div className="space-y-2 rounded border border-cyan-100 bg-cyan-50/50 p-2">
          <TextBlock label="AI input" value={data.aiInput} />
          <TextBlock label="Expected output" value={data.aiExpectedOutput} />
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Steps</p>
          <ol className="mt-2 space-y-2">
            {steps.map((step, index) => (
              <li
                key={step.id ?? `${step.stepOrder ?? index + 1}-${index}`}
                className="rounded border border-slate-200 bg-white px-2.5 py-2 text-sm"
              >
                <p className="text-[11px] font-medium text-slate-500">Step {step.stepOrder ?? index + 1}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{step.description || "—"}</p>
                {step.expected?.trim() ? (
                  <p className="mt-1.5 whitespace-pre-wrap border-t border-slate-100 pt-1.5 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Expected: </span>
                    {step.expected}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <TextBlock label="Expected result" value={data.expectedResult} />
      )}

      {scenarios.length > 0 ? (
        <details className="group" open>
          <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-wide text-slate-500">
            BDD scenarios ({scenarios.length})
          </summary>
          <div className="mt-2 space-y-2">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-medium text-slate-700">{scenario.name}</p>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-600">
                  {scenario.content}
                </pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {data.references?.trim() ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">References</p>
          <div className="mt-1 text-sm">
            <CaseRefTokens refsValue={data.references} projectId={projectId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

