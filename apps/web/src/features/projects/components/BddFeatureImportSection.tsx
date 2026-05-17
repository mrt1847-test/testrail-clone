import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { importBddFeature, exportBddFeature } from "../../cases/api/bddApi";

type Props = {
  projectId: string;
};

export function BddFeatureImportSection({ projectId }: Props) {
  const [sectionId, setSectionId] = useState("");
  const [featureText, setFeatureText] = useState(
    `Feature: Sample checkout\n  Scenario: Guest pays with card\n    Given a guest cart\n    When checkout completes\n    Then order is confirmed\n`
  );
  const [message, setMessage] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: () =>
      importBddFeature(projectId, {
        sectionId,
        featureText,
        createOneCasePerFeature: true
      }),
    onSuccess: (data) => {
      setMessage(`Imported ${data.importedCases} case(s).`);
    },
    onError: (err: Error) => setMessage(err.message)
  });

  const exportMutation = useMutation({
    mutationFn: () => exportBddFeature(projectId, { sectionId: sectionId || undefined }),
    onSuccess: (text) => {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "export.feature";
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Exported .feature file.");
    },
    onError: (err: Error) => setMessage(err.message)
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">BDD / Gherkin (.feature)</h3>
      <p className="mt-1 text-xs text-slate-500">
        Import Gherkin features into BDD template cases or export mapped scenarios as a .feature file.
      </p>
      <label className="mt-3 block text-xs text-slate-600">
        Target section ID
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Section ID from case workspace"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs text-slate-600">
        Feature file content
        <textarea
          className="mt-1 h-40 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          value={featureText}
          onChange={(e) => setFeatureText(e.target.value)}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50"
          disabled={!sectionId.trim() || importMutation.isPending}
          onClick={() => void importMutation.mutateAsync()}
        >
          Import .feature
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-50"
          disabled={!sectionId.trim() || exportMutation.isPending}
          onClick={() => void exportMutation.mutateAsync()}
        >
          Export section .feature
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}
    </section>
  );
}
