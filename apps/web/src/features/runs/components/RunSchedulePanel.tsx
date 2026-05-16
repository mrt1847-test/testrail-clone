import { useEffect, useState } from "react";

import type { RunDetail } from "../types";
import { dateInputToIso, toDateInputValue } from "../utils/runDates";

type RunSchedulePanelProps = {
  run: RunDetail;
  dateWarnings: string[];
  canEdit: boolean;
  isSaving: boolean;
  onSave: (patch: { startedAt: string | null; dueOn: string | null }) => Promise<void>;
};

export function RunSchedulePanel({ run, dateWarnings, canEdit, isSaving, onSave }: RunSchedulePanelProps) {
  const [startDate, setStartDate] = useState(toDateInputValue(run.startedAt));
  const [endDate, setEndDate] = useState(toDateInputValue(run.dueOn));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setStartDate(toDateInputValue(run.startedAt));
    setEndDate(toDateInputValue(run.dueOn));
    setDirty(false);
  }, [run.startedAt, run.dueOn, run.id]);

  const closedLabel = run.closedAt ? new Date(run.closedAt).toLocaleString() : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <h3 className="font-medium text-slate-900">Schedule</h3>
      <p className="mt-1 text-xs text-slate-500">
        Planned start and end dates are optional. Closing a run is manual and does not happen automatically when the end
        date passes.
      </p>

      {dateWarnings.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
          {dateWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-slate-700">
          <span>Start date</span>
          <input
            type="date"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            value={startDate}
            disabled={!canEdit || isSaving}
            onChange={(event) => {
              setStartDate(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-700">
          <span>End date</span>
          <input
            type="date"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            value={endDate}
            disabled={!canEdit || isSaving}
            onChange={(event) => {
              setEndDate(event.target.value);
              setDirty(true);
            }}
          />
        </label>
      </div>

      {closedLabel ? <p className="mt-2 text-xs text-slate-600">Closed {closedLabel}</p> : null}

      {canEdit && run.status === "open" ? (
        <button
          type="button"
          className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          disabled={!dirty || isSaving}
          onClick={() =>
            void onSave({
              startedAt: dateInputToIso(startDate),
              dueOn: dateInputToIso(endDate)
            })
          }
        >
          {isSaving ? "Saving…" : "Save dates"}
        </button>
      ) : null}
    </section>
  );
}
