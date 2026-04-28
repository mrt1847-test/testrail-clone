import { useState } from "react";

export type ResultStatus = "passed" | "failed" | "blocked" | "retest" | "untested";

export type ResultSubmitPayload = {
  status: ResultStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects: string[];
  stepResults: Array<{ stepOrder: number; status: ResultStatus; comment?: string }>;
};

type ResultEntryPanelProps = {
  instance: { id: string; caseCode: string; title: string };
  isSubmitting: boolean;
  onSubmit: (payload: ResultSubmitPayload) => void;
};

export function ResultEntryPanel({ instance, isSubmitting, onSubmit }: ResultEntryPanelProps) {
  const [nextStatus, setNextStatus] = useState<ResultStatus>("passed");
  const [comment, setComment] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [version, setVersion] = useState("");
  const [defects, setDefects] = useState("");
  const [step1Status, setStep1Status] = useState<ResultStatus>("passed");
  const [step1Comment, setStep1Comment] = useState("");

  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>
        <span className="font-mono text-xs">{instance.caseCode}</span> — {instance.title}
      </p>
      <div className="rounded border border-slate-200 p-2">
        <p className="text-xs font-medium text-slate-700">Submit result</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as ResultStatus)}
          >
            <option value="passed">passed</option>
            <option value="failed">failed</option>
            <option value="blocked">blocked</option>
            <option value="retest">retest</option>
            <option value="untested">untested</option>
          </select>
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs sm:min-w-[120px]"
            placeholder="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-28"
            placeholder="elapsed"
            value={elapsed}
            onChange={(e) => setElapsed(e.target.value)}
          />
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-28"
            placeholder="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <input
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-36"
            placeholder="defects (comma-separated)"
            value={defects}
            onChange={(e) => setDefects(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => {
              onSubmit({
                status: nextStatus,
                comment: comment.trim() || undefined,
                elapsed: elapsed.trim() || undefined,
                version: version.trim() || undefined,
                defects: defects
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                stepResults: [
                  {
                    stepOrder: 1,
                    status: step1Status,
                    comment: step1Comment.trim() || undefined
                  }
                ]
              });
              setComment("");
              setElapsed("");
              setVersion("");
              setDefects("");
              setStep1Comment("");
            }}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            value={step1Status}
            onChange={(e) => setStep1Status(e.target.value as ResultStatus)}
          >
            <option value="passed">step 1 — passed</option>
            <option value="failed">step 1 — failed</option>
            <option value="blocked">step 1 — blocked</option>
            <option value="retest">step 1 — retest</option>
            <option value="untested">step 1 — untested</option>
          </select>
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="step 1 comment"
            value={step1Comment}
            onChange={(e) => setStep1Comment(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
