import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchCrossProjectGlobalSearch } from "../api/projectSearchApi";
import { ENTITY_LABELS, groupHitsByProject } from "../utils/globalSearchGroups";

export function CrossProjectGlobalSearch() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ["cross-project-global-search", debounced],
    queryFn: () => fetchCrossProjectGlobalSearch(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000
  });

  const projectGroups = useMemo(
    () => groupHitsByProject(searchQuery.data?.items ?? []),
    [searchQuery.data?.items]
  );

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const showPanel = open && debounced.length >= 2;

  return (
    <div ref={rootRef} className="relative min-w-[12rem] flex-1 max-w-lg">
      <label className="sr-only" htmlFor="cross-project-global-search">
        Search all projects
      </label>
      <input
        id="cross-project-global-search"
        type="search"
        placeholder="Search all projects… (C12, R5, login)"
        className="w-full rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[28rem] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {searchQuery.isLoading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Searching all projects…</p>
          ) : searchQuery.isError ? (
            <p className="px-3 py-2 text-sm text-red-700">Search failed. Try again.</p>
          ) : projectGroups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No matches for &quot;{debounced}&quot;.</p>
          ) : (
            projectGroups.map((project) => (
              <div
                key={project.projectId}
                className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
              >
                <p className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {project.projectName}
                </p>
                {project.entityGroups.map((group) => (
                  <div key={`${project.projectId}-${group.type}`}>
                    <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {ENTITY_LABELS[group.type]}
                    </p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={`${item.entityType}-${item.projectId}-${item.id}`}>
                          <Link
                            to={`/projects/${item.projectId}/${item.path}`}
                            className="block px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => {
                              setOpen(false);
                              setQuery("");
                            }}
                          >
                            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                              {item.title}
                            </span>
                            {item.subtitle ? (
                              <span className="block text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
