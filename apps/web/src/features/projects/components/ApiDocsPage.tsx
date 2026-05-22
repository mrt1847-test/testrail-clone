import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { API_BASE } from "../../../shared/api/http";
import { copyTextToClipboard } from "../../../shared/utils/clipboard";
import { downloadJsonFile, fetchJsonExport } from "../../../shared/utils/downloadJson";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchTestRailV2Index } from "../api/testRailApi";
import {
  buildAllApiDocEndpoints,
  groupEndpointsByCategory,
  type ApiDocEndpoint
} from "../utils/testRailCurlExamples";

function CopyCurlButton({ curl }: { curl: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    const ok = await copyTextToClipboard(curl);
    setStatus(ok ? "copied" : "error");
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  const label = status === "copied" ? "Copied" : status === "error" ? "Copy failed" : "Copy curl";

  return (
    <button
      type="button"
      className="shrink-0 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      onClick={() => void handleCopy()}
    >
      {label}
    </button>
  );
}

function EndpointCard({ endpoint }: { endpoint: ApiDocEndpoint }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
              {endpoint.method}
            </span>
            <code className="break-all font-mono text-xs text-slate-800">{endpoint.path}</code>
          </div>
          <p className="text-sm text-slate-600">{endpoint.description}</p>
        </div>
        <CopyCurlButton curl={endpoint.curl} />
      </div>
      <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800">
        {endpoint.curl}
      </pre>
    </article>
  );
}

function ExportDownloadButton({
  label,
  filename,
  exportPath
}: {
  label: string;
  filename: string;
  exportPath: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const payload = await fetchJsonExport(exportPath);
      downloadJsonFile(filename, payload);
    } catch {
      setError("Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        onClick={() => void handleDownload()}
      >
        {busy ? "Preparing…" : label}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </div>
  );
}

export function ApiDocsPage() {
  const { projectId = "" } = useParams();
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<"" | "GET" | "POST">("");

  const indexQuery = useQuery({
    queryKey: ["testrail-v2-index"],
    queryFn: fetchTestRailV2Index,
    staleTime: 60_000
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : API_BASE;

  const endpoints = useMemo(() => {
    if (!indexQuery.data) return [];
    return buildAllApiDocEndpoints(indexQuery.data.supported, { baseUrl, projectId });
  }, [baseUrl, indexQuery.data, projectId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return endpoints.filter((row) => {
      if (methodFilter && row.method !== methodFilter) return false;
      if (!needle) return true;
      return (
        row.key.toLowerCase().includes(needle) ||
        row.path.toLowerCase().includes(needle) ||
        row.category.toLowerCase().includes(needle) ||
        row.curl.toLowerCase().includes(needle)
      );
    });
  }, [endpoints, methodFilter, query]);

  const grouped = useMemo(() => groupEndpointsByCategory(filtered), [filtered]);

  if (indexQuery.isLoading) {
    return <LoadingState message="Loading API reference..." />;
  }

  if (indexQuery.isError || !indexQuery.data) {
    return <ErrorState title="Could not load API index" onRetry={() => void indexQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">API reference</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Copy-ready curl examples for TestRail-compatible <code className="text-xs">/api/v2</code> routes and
          automation upload endpoints. Replace{" "}
          <code className="text-xs">$QA_RAIL_TOKEN</code> with a project API token (
          <Link to={`/projects/${projectId}/settings/tokens`} className="text-slate-800 underline">
            manage tokens
          </Link>
          ) or your user JWT for interactive mutations.
        </p>
        {indexQuery.data.note ? (
          <p className="mt-2 text-xs text-slate-500">{indexQuery.data.note}</p>
        ) : null}
        {indexQuery.data.deferred.length > 0 ? (
          <p className="mt-2 text-xs text-amber-800">
            Deferred endpoints: {indexQuery.data.deferred.join(", ")}
          </p>
        ) : null}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Export</h2>
        <p className="mt-1 text-sm text-slate-600">
          Machine-readable specs generated from the {indexQuery.data.supported.length} implemented{" "}
          <code className="text-xs">/api/v2</code> routes.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <ExportDownloadButton
            label="Download OpenAPI 3.0"
            filename="qa-rail-api-v2.openapi.json"
            exportPath={`${API_BASE}/api/v2/openapi.json`}
          />
          <ExportDownloadButton
            label="Download Postman collection"
            filename="qa-rail-api-v2.postman_collection.json"
            exportPath={`${API_BASE}/api/v2/postman-collection.json`}
          />
        </div>
        {indexQuery.data.exports ? (
          <p className="mt-3 text-xs text-slate-500">
            Direct URLs:{" "}
            <a href={indexQuery.data.exports.openapi} className="text-slate-700 underline">
              OpenAPI
            </a>
            {" · "}
            <a href={indexQuery.data.exports.postman} className="text-slate-700 underline">
              Postman
            </a>
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block min-w-[14rem] flex-1 space-y-1 text-sm text-slate-700">
          <span className="font-medium">Search</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. get_cases, add_run, automation"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-700">
          <span className="font-medium">Method</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value as "" | "GET" | "POST")}
          >
            <option value="">All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Showing {filtered.length} of {endpoints.length} examples
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No endpoints match the current filters.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, rows]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{category}</h2>
              <div className="space-y-3">
                {rows.map((endpoint) => (
                  <EndpointCard key={endpoint.key} endpoint={endpoint} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Full matrix and scope notes live in <code className="text-[11px]">docs/API_SPEC.md</code> and{" "}
        <code className="text-[11px]">docs/CI_AND_COMPATIBILITY_EXAMPLES.md</code> in the repository.
      </p>
    </div>
  );
}
