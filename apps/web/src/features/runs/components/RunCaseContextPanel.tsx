import { Link } from "react-router-dom";

import { Button } from "../../../shared/ui/Button";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import type { CaseScenarioRow } from "../../cases/api/bddApi";
import { CaseRefTokens } from "../../cases/components/CaseRefTokens";
import { buildCaseDetailPath } from "../../cases/caseRoute";
import type { TestCase } from "../../cases/types";
import { buildRunCaseInstructionModel } from "../utils/runCaseInstructionModel";
import { RunCaseInstructionBody } from "./RunCaseInstructionBody";

type Props = {
  projectId: string;
  caseId: string;
  caseCode: string;
  title: string;
  status: string;
  data: TestCase | undefined;
  scenarios?: CaseScenarioRow[];
  isLoading: boolean;
  isError?: boolean;
  onBackToList?: () => void;
  onPrevTest?: () => void;
  onNextTest?: () => void;
  isNavigating?: boolean;
};

export function RunCaseContextPanel({
  projectId,
  caseId,
  caseCode,
  title,
  status,
  data,
  scenarios = [],
  isLoading,
  isError = false,
  onBackToList,
  onPrevTest,
  onNextTest,
  isNavigating = false
}: Props) {
  const model = data
    ? buildRunCaseInstructionModel({
        preconditions: data.preconditions,
        expectedResult: data.expectedResult,
        steps: data.steps,
        mission: data.mission,
        goals: data.goals,
        aiInput: data.aiInput,
        aiExpectedOutput: data.aiExpectedOutput,
        scenarios
      })
    : null;

  return (
    <div className="space-y-3 pb-2">
      {onBackToList ? (
        <Button type="button" size="sm" variant="ghost" className="lg:hidden" onClick={onBackToList}>
          Back to tests
        </Button>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-slate-500">{caseCode}</p>
            <StatusBadge status={status} />
          </div>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{title}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {onPrevTest ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isNavigating}
              aria-label="Previous test"
              title="Previous test (K)"
              onClick={onPrevTest}
            >
              ← Prev
            </Button>
          ) : null}
          {onNextTest ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isNavigating}
              aria-label="Next test"
              title="Next test (J)"
              onClick={onNextTest}
            >
              Next →
            </Button>
          ) : null}
          <Link
            to={buildCaseDetailPath(projectId, Number(caseId))}
            className="px-1 text-xs font-medium text-indigo-800 hover:underline"
          >
            Open case
          </Link>
        </div>
      </div>

      {isLoading ? <LoadingState message="Loading case…" /> : null}
      {!isLoading && isError ? (
        <p className="text-sm text-slate-500">Could not load case details. Retry from the case page or refresh.</p>
      ) : null}
      {!isLoading && !isError && !data ? (
        <p className="text-sm text-slate-500">Case details are unavailable.</p>
      ) : null}

      {data && model ? (
        <>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <div>
              <dt className="inline text-slate-500">Type </dt>
              <dd className="inline font-medium text-slate-800">{data.type}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Priority </dt>
              <dd className="inline font-medium text-slate-800">{data.priority}</dd>
            </div>
            {data.estimate?.trim() ? (
              <div>
                <dt className="inline text-slate-500">Estimate </dt>
                <dd className="inline font-medium text-slate-800">{data.estimate}</dd>
              </div>
            ) : null}
            {data.references?.trim() ? (
              <div className="min-w-0">
                <dt className="inline text-slate-500">References </dt>
                <dd className="inline">
                  <CaseRefTokens refsValue={data.references} projectId={projectId} />
                </dd>
              </div>
            ) : null}
          </dl>
          <RunCaseInstructionBody model={model} />
        </>
      ) : null}
    </div>
  );
}
