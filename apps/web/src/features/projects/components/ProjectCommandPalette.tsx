import { useEffect, useMemo, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { useNavigate } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";



import { useAuth } from "../../auth/context/AuthContext";

import { fetchProjectGlobalSearch, type GlobalSearchHit } from "../api/projectSearchApi";

import { buildEntityJumpPath, entityJumpLabel, parseEntityJumpToken } from "../utils/entityJump";

import {

  buildRecentlyViewedPath,

  filterRecentlyViewed,

  getRecentlyViewed,

  type RecentlyViewedEntry

} from "../utils/recentlyViewed";



const ENTITY_LABELS: Record<GlobalSearchHit["entityType"] | RecentlyViewedEntry["kind"], string> = {

  case: "Case",

  run: "Run",

  milestone: "Milestone",

  plan: "Plan",

  defect: "Defect"

};



type ProjectCommandPaletteProps = {

  projectId: string;

  open: boolean;

  onClose: () => void;

};



function useDebouncedValue(value: string, delayMs: number) {

  const [debounced, setDebounced] = useState(value);

  useEffect(() => {

    const timer = window.setTimeout(() => setDebounced(value.trim()), delayMs);

    return () => window.clearTimeout(timer);

  }, [value, delayMs]);

  return debounced;

}



export function ProjectCommandPalette({ projectId, open, onClose }: ProjectCommandPaletteProps) {

  const navigate = useNavigate();

  const { user } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");

  const [activeIndex, setActiveIndex] = useState(0);

  const [recentItems, setRecentItems] = useState<RecentlyViewedEntry[]>([]);

  const debounced = useDebouncedValue(query, 200);



  const jumpTarget = useMemo(() => parseEntityJumpToken(debounced), [debounced]);

  const showSearchResults = debounced.length >= 2 && jumpTarget == null;



  const filteredRecent = useMemo(

    () => filterRecentlyViewed(recentItems, debounced),

    [debounced, recentItems]

  );



  const searchQuery = useQuery({

    queryKey: ["project-command-palette", projectId, debounced],

    queryFn: () => fetchProjectGlobalSearch(projectId, debounced),

    enabled: Boolean(projectId) && open && showSearchResults,

    staleTime: 30_000

  });



  const hits = showSearchResults ? (searchQuery.data?.items ?? []) : [];

  const jumpRowCount = jumpTarget ? 1 : 0;

  const recentRowCount = showSearchResults ? 0 : filteredRecent.length;

  const totalRows = jumpRowCount + recentRowCount + hits.length;



  useEffect(() => {

    if (!open) return;

    setQuery("");

    setActiveIndex(0);

    setRecentItems(getRecentlyViewed(projectId, user?.id));

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => window.clearTimeout(timer);

  }, [open, projectId, user?.id]);



  useEffect(() => {

    setActiveIndex(0);

  }, [debounced, hits.length, jumpTarget?.kind, jumpTarget?.id, filteredRecent.length]);



  useEffect(() => {

    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {

      if (event.key === "Escape") {

        event.preventDefault();

        onClose();

        return;

      }

      if (totalRows === 0) return;

      if (event.key === "ArrowDown") {

        event.preventDefault();

        setActiveIndex((index) => (index + 1) % totalRows);

      }

      if (event.key === "ArrowUp") {

        event.preventDefault();

        setActiveIndex((index) => (index - 1 + totalRows) % totalRows);

      }

    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [onClose, open, totalRows]);



  function navigateToPath(path: string) {

    navigate(path.startsWith("/") ? path : `/projects/${projectId}/${path}`);

    onClose();

    setQuery("");

  }



  function goToJumpTarget() {

    if (!jumpTarget) return;

    navigateToPath(buildEntityJumpPath(projectId, jumpTarget));

  }



  function goToHit(hit: GlobalSearchHit) {

    navigateToPath(`/projects/${projectId}/${hit.path}`);

  }



  function goToRecent(entry: RecentlyViewedEntry) {

    navigateToPath(buildRecentlyViewedPath(projectId, entry));

  }



  function handleSubmit() {

    if (jumpTarget) {

      goToJumpTarget();

      return;

    }

    if (activeIndex < recentRowCount) {

      const entry = filteredRecent[activeIndex];

      if (entry) goToRecent(entry);

      return;

    }

    const hit = hits[activeIndex - jumpRowCount - recentRowCount];

    if (hit) goToHit(hit);

  }



  function rowOffsetAfterJump() {

    return jumpRowCount;

  }



  function rowOffsetAfterRecent() {

    return jumpRowCount + recentRowCount;

  }



  if (!open || typeof document === "undefined") return null;



  return createPortal(

    <div

      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]"

      role="presentation"

      onClick={onClose}

    >

      <div

        role="dialog"

        aria-modal="true"

        aria-label="Command palette"

        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"

        onClick={(event) => event.stopPropagation()}

      >

        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">

          <input

            ref={inputRef}

            type="text"

            value={query}

            placeholder="Jump to C123, R45, M12… or search"

            autoComplete="off"

            spellCheck={false}

            className="w-full border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"

            onChange={(e) => setQuery(e.target.value)}

            onKeyDown={(e) => {

              if (e.key === "Enter") {

                e.preventDefault();

                handleSubmit();

              }

            }}

          />

        </div>



        <div className="max-h-72 overflow-auto py-1">

          {jumpTarget ? (

            <button

              type="button"

              className={[

                "flex w-full flex-col px-4 py-2.5 text-left",

                activeIndex === 0 ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"

              ].join(" ")}

              onMouseEnter={() => setActiveIndex(0)}

              onClick={() => goToJumpTarget()}

            >

              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">

                Jump to {ENTITY_LABELS[jumpTarget.kind]} {entityJumpLabel(jumpTarget)}

              </span>

              <span className="text-xs text-slate-500 dark:text-slate-400">Press Enter to open</span>

            </button>

          ) : null}



          {!jumpTarget && !showSearchResults && filteredRecent.length > 0 ? (

            <div className="border-b border-slate-100 pb-1 dark:border-slate-800">

              <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">

                Recently viewed

              </p>

              {filteredRecent.map((entry, index) => {

                const rowIndex = rowOffsetAfterJump() + index;

                return (

                  <button

                    key={`recent-${entry.kind}-${entry.id}`}

                    type="button"

                    className={[

                      "flex w-full flex-col px-4 py-2.5 text-left",

                      activeIndex === rowIndex

                        ? "bg-sky-50 dark:bg-sky-950/40"

                        : "hover:bg-slate-50 dark:hover:bg-slate-800"

                    ].join(" ")}

                    onMouseEnter={() => setActiveIndex(rowIndex)}

                    onClick={() => goToRecent(entry)}

                  >

                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">

                      {ENTITY_LABELS[entry.kind]}

                    </span>

                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.title}</span>

                    {entry.subtitle ? (

                      <span className="text-xs text-slate-500 dark:text-slate-400">{entry.subtitle}</span>

                    ) : null}

                  </button>

                );

              })}

            </div>

          ) : null}



          {!jumpTarget && debounced.length < 2 && filteredRecent.length === 0 ? (

            <p className="px-4 py-3 text-sm text-slate-500">

              Type an entity ID (<span className="font-mono">C123</span>, <span className="font-mono">R45</span>,{" "}

              <span className="font-mono">M12</span>) or at least 2 characters to search. Open a case, run, or

              milestone to build your recent list.

            </p>

          ) : null}



          {showSearchResults && searchQuery.isLoading ? (

            <p className="px-4 py-2 text-sm text-slate-500">Searching…</p>

          ) : null}



          {showSearchResults && searchQuery.isError ? (

            <p className="px-4 py-2 text-sm text-red-700">Search failed. Try again.</p>

          ) : null}



          {showSearchResults && !searchQuery.isLoading && hits.length === 0 ? (

            <p className="px-4 py-2 text-sm text-slate-500">No matches for &quot;{debounced}&quot;.</p>

          ) : null}



          {hits.map((hit, index) => {

            const rowIndex = rowOffsetAfterRecent() + index;

            return (

              <button

                key={`${hit.entityType}-${hit.id}`}

                type="button"

                className={[

                  "flex w-full flex-col px-4 py-2.5 text-left",

                  activeIndex === rowIndex

                    ? "bg-sky-50 dark:bg-sky-950/40"

                    : "hover:bg-slate-50 dark:hover:bg-slate-800"

                ].join(" ")}

                onMouseEnter={() => setActiveIndex(rowIndex)}

                onClick={() => goToHit(hit)}

              >

                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">

                  {ENTITY_LABELS[hit.entityType]}

                </span>

                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{hit.title}</span>

                {hit.subtitle ? (

                  <span className="text-xs text-slate-500 dark:text-slate-400">{hit.subtitle}</span>

                ) : null}

              </button>

            );

          })}

        </div>



        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-700">

          <span>

            <kbd className="rounded border border-slate-300 px-1 dark:border-slate-600">↑↓</kbd> navigate{" "}

            <kbd className="rounded border border-slate-300 px-1 dark:border-slate-600">↵</kbd> open{" "}

            <kbd className="rounded border border-slate-300 px-1 dark:border-slate-600">esc</kbd> close

          </span>

          <span className="font-mono">⌘K / Ctrl+K</span>

        </div>

      </div>

    </div>,

    document.body

  );

}



export function useProjectCommandPalette() {

  const [open, setOpen] = useState(false);



  useEffect(() => {

    function onKeyDown(event: KeyboardEvent) {

      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;

      const target = event.target;

      if (target instanceof HTMLElement && target.isContentEditable) return;

      event.preventDefault();

      setOpen((value) => !value);

    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, []);



  return { open, setOpen, onClose: () => setOpen(false) };

}


