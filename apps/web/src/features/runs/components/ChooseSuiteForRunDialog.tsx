import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "../../../shared/ui/Button";
import { Drawer } from "../../../shared/ui/Drawer";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchSuites } from "../../projects/api/suitesApi";

type ChooseSuiteForRunDialogProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

export function ChooseSuiteForRunDialog({ projectId, open, onClose }: ChooseSuiteForRunDialogProps) {
  const navigate = useNavigate();
  const [suiteId, setSuiteId] = useState("");
  const suitesQuery = useQuery({
    queryKey: ["choose-suite-for-run", projectId],
    queryFn: () => fetchSuites(projectId),
    enabled: open && Boolean(projectId)
  });

  function startRun() {
    if (!suiteId) return;
    onClose();
    navigate(`/projects/${projectId}/runs/new?suiteId=${encodeURIComponent(suiteId)}`);
  }

  return (
    <Drawer open={open} onClose={onClose} title="Choose test suite" widthClassName="max-w-md">
      {suitesQuery.isLoading ? (
        <LoadingState message="Loading suites…" />
      ) : (
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select the suite for the new test run. You can change composition on the next screen.
          </p>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Suite
            <select
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={suiteId}
              onChange={(e) => setSuiteId(e.target.value)}
            >
              <option value="">Select a suite…</option>
              {(suitesQuery.data ?? []).map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={startRun} disabled={!suiteId}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
