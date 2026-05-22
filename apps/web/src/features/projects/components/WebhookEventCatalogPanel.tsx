import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { copyTextToClipboard } from "../../../shared/utils/clipboard";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchWebhookEventCatalog, type WebhookCatalogEntry } from "../api/advancedApi";

function CopyJsonButton({ label, value }: { label: string; value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    const ok = await copyTextToClipboard(value);
    setStatus(ok ? "copied" : "error");
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  const text = status === "copied" ? "Copied" : status === "error" ? "Copy failed" : label;

  return (
    <button
      type="button"
      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      onClick={() => void handleCopy()}
    >
      {text}
    </button>
  );
}

function CatalogRow({ entry }: { entry: WebhookCatalogEntry }) {
  const [open, setOpen] = useState(false);
  const payloadJson = useMemo(() => JSON.stringify(entry.samplePayload, null, 2), [entry.samplePayload]);
  const headersJson = useMemo(() => JSON.stringify(entry.sampleHeaders, null, 2), [entry.sampleHeaders]);
  const deliveryExample = useMemo(
    () =>
      JSON.stringify(
        {
          headers: entry.sampleHeaders,
          body: entry.samplePayload
        },
        null,
        2
      ),
    [entry.sampleHeaders, entry.samplePayload]
  );

  return (
    <article className="border-b border-slate-100 last:border-b-0 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="text-left"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <code className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.event}</code>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{entry.description}</p>
            {open ? null : (
              <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-500">
                Example delivery: <span className="text-slate-700 dark:text-slate-300">{entry.samplePayload.eventType as string}</span>
              </p>
            )}
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopyJsonButton label="Copy payload" value={payloadJson} />
          <CopyJsonButton label="Copy delivery" value={deliveryExample} />
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/50">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Headers</p>
            <pre className="overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
              {headersJson}
            </pre>
            <div className="mt-2">
              <CopyJsonButton label="Copy headers" value={headersJson} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">JSON body</p>
            <pre className="max-h-72 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
              {payloadJson}
            </pre>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deliveries use the activity event envelope. Wildcard subscriptions still send a concrete{" "}
            <code className="font-mono">eventType</code> in the body; the sample shows a representative match.
            Test send uses <code className="font-mono">webhook.test</code> instead.
          </p>
        </div>
      ) : null}
    </article>
  );
}

type WebhookEventCatalogPanelProps = {
  projectId: string;
};

export function WebhookEventCatalogPanel({ projectId }: WebhookEventCatalogPanelProps) {
  const [query, setQuery] = useState("");

  const catalogQuery = useQuery({
    queryKey: ["webhook-event-catalog", projectId],
    queryFn: () => fetchWebhookEventCatalog(projectId),
    enabled: Boolean(projectId)
  });

  const filtered = useMemo(() => {
    const rows = catalogQuery.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.event.toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle) ||
        String(row.samplePayload.eventType ?? "").toLowerCase().includes(needle)
    );
  }, [catalogQuery.data, query]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Event catalog
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Sample JSON payloads for each subscription pattern. Copy payloads when building or testing integrators.
        </p>
        <input
          className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Filter by event name or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {catalogQuery.isLoading ? (
        <div className="p-4">
          <LoadingState message="Loading event catalog..." />
        </div>
      ) : catalogQuery.isError ? (
        <div className="p-4">
          <ErrorState title="Could not load event catalog" onRetry={() => catalogQuery.refetch()} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No events match your filter.</p>
      ) : (
        <div>
          {filtered.map((entry) => (
            <CatalogRow key={entry.event} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
