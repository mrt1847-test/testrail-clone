import { CommentComposer } from "../../comments/CommentComposer";
import type { ResultStatus } from "./resultEntryTypes";
import type { CaseScenarioRow } from "../../cases/api/bddApi";

export type ScenarioResultDraft = {
  caseScenarioId: string;
  status: ResultStatus;
  comment: string;
};

type Props = {
  projectId?: string;
  scenarios: CaseScenarioRow[];
  value: ScenarioResultDraft[];
  onChange: (next: ScenarioResultDraft[]) => void;
  disabled?: boolean;
};

export function createScenarioResultDrafts(scenarios: CaseScenarioRow[]): ScenarioResultDraft[] {
  return scenarios.map((row) => ({
    caseScenarioId: row.id,
    status: "passed" as ResultStatus,
    comment: ""
  }));
}

export function ScenarioResultEditor({ projectId, scenarios, value, onChange, disabled = false }: Props) {
  if (scenarios.length === 0) return null;

  return (
    <div className="space-y-2 rounded border border-emerald-200 bg-emerald-50/40 p-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Scenario results</p>
      <ul className="space-y-2">
        {scenarios.map((scenario) => {
          const draft = value.find((row) => row.caseScenarioId === scenario.id) ?? {
            caseScenarioId: scenario.id,
            status: "passed" as ResultStatus,
            comment: ""
          };
          return (
            <li key={scenario.id} className="rounded border border-emerald-200 bg-white p-2 text-xs">
              <p className="font-medium text-slate-900">{scenario.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="rounded border border-slate-300 px-1 py-0.5"
                  value={draft.status}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(
                      value.map((row) =>
                        row.caseScenarioId === scenario.id
                          ? { ...row, status: e.target.value as ResultStatus }
                          : row
                      )
                    )
                  }
                >
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="blocked">Blocked</option>
                  <option value="retest">Retest</option>
                </select>
                {projectId ? (
                  <div className="min-w-[10rem] flex-1">
                    <CommentComposer
                      projectId={projectId}
                      value={draft.comment}
                      onChange={(comment) =>
                        onChange(
                          value.map((row) =>
                            row.caseScenarioId === scenario.id ? { ...row, comment } : row
                          )
                        )
                      }
                      rows={1}
                      disabled={disabled}
                      showTemplates={false}
                      showPreview={false}
                      placeholder="Comment"
                      textareaClassName="w-full rounded border border-slate-300 px-2 py-0.5 text-xs"
                    />
                  </div>
                ) : (
                  <input
                    className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-0.5"
                    placeholder="Comment"
                    value={draft.comment}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        value.map((row) =>
                          row.caseScenarioId === scenario.id ? { ...row, comment: e.target.value } : row
                        )
                      )
                    }
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
