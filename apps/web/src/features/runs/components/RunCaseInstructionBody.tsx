import type { RunCaseInstructionModel } from "../utils/runCaseInstructionModel";

type Props = {
  model: RunCaseInstructionModel;
};

function Block({ label, value }: { label: string; value: string }) {
  return (
    <section className="space-y-1">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</h4>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{value}</p>
    </section>
  );
}

export function RunCaseInstructionBody({ model }: Props) {
  if (model.isEmpty) {
    return <p className="text-sm text-slate-500">No instructions written for this case.</p>;
  }

  return (
    <div className="run-case-instruction space-y-4">
      {model.preconditions ? <Block label="Preconditions" value={model.preconditions} /> : null}

      {model.mission || model.goals ? (
        <div className="space-y-3">
          {model.mission ? <Block label="Mission" value={model.mission} /> : null}
          {model.goals ? <Block label="Goals" value={model.goals} /> : null}
        </div>
      ) : null}

      {model.aiInput || model.aiExpectedOutput ? (
        <div className="space-y-3">
          {model.aiInput ? <Block label="AI input" value={model.aiInput} /> : null}
          {model.aiExpectedOutput ? <Block label="Expected output" value={model.aiExpectedOutput} /> : null}
        </div>
      ) : null}

      {model.steps.length > 0 ? (
        <section>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Steps</h4>
          <ol className="mt-2 list-none space-y-3 p-0">
            {model.steps.map((step) => (
              <li key={step.order} className="run-case-instruction__step">
                <span className="run-case-instruction__step-index text-xs font-semibold text-slate-500">
                  {step.order}.
                </span>
                <div className="run-case-instruction__action min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Action</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {step.action || "—"}
                  </p>
                </div>
                <div className="run-case-instruction__expected min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Expected</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {step.expected ?? "—"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {model.textInstructions ? <Block label="Steps" value={model.textInstructions} /> : null}
      {model.commonExpected ? <Block label="Expected result" value={model.commonExpected} /> : null}

      {model.scenarios.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">BDD scenarios</h4>
          {model.scenarios.map((scenario, index) => (
            <div key={scenario.id ?? `${scenario.name}-${index}`}>
              <p className="text-sm font-medium text-slate-800">{scenario.name}</p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                {scenario.content}
              </pre>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
