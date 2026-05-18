import { useMemo } from "react";

import type { RunDetailDto } from "../types";
import { describeDonutSlice } from "../utils/runProgressChartGeometry";
import { RUN_STATUS_SEGMENTS, runPassedPercent, runStatusTotal } from "../utils/runProgressSegments";

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus?: string;
  onStatusClick?: (status: string) => void;
  size?: number;
  className?: string;
};

type Slice = {
  key: string;
  label: string;
  color: string;
  count: number;
  path: string;
  midAngle: number;
};

export function RunProgressChart({
  counts,
  activeStatus = "all",
  onStatusClick,
  size = 128,
  className = ""
}: Props) {
  const total = runStatusTotal(counts);
  const passedPct = runPassedPercent(counts);
  const interactive = Boolean(onStatusClick);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.58;

  const slices = useMemo(() => {
    if (total <= 0) return [] as Slice[];
    let angle = 0;
    const out: Slice[] = [];
    for (const segment of RUN_STATUS_SEGMENTS) {
      const count = counts[segment.key];
      if (count <= 0) continue;
      const sweep = (count / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      out.push({
        key: segment.key,
        label: segment.label,
        color: segment.color,
        count,
        path: describeDonutSlice(cx, cy, outerR, innerR, start, end),
        midAngle: start + sweep / 2
      });
    }
    return out;
  }, [counts, cx, cy, innerR, outerR, total]);

  return (
    <div className={`flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-4 ${className}`.trim()}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Run status breakdown">
          <circle cx={cx} cy={cy} r={outerR} fill="#f1f5f9" />
          {total <= 0 ? (
            <circle cx={cx} cy={cy} r={innerR} fill="#fff" />
          ) : (
            slices.map((slice) => {
              const selected = activeStatus === slice.key;
              return (
                <path
                  key={slice.key}
                  d={slice.path}
                  fill={slice.color}
                  stroke={selected ? "#0f172a" : "#fff"}
                  strokeWidth={selected ? 2 : 1}
                  className={interactive ? "cursor-pointer transition-opacity hover:opacity-90" : undefined}
                  onClick={
                    interactive
                      ? () => {
                          onStatusClick?.(slice.key);
                        }
                      : undefined
                  }
                >
                  <title>
                    {slice.label}: {slice.count}
                  </title>
                </path>
              );
            })
          )}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
          aria-hidden
        >
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{passedPct}%</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">passed</span>
        </div>
      </div>
      {interactive ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 sm:grid-cols-1">
          {RUN_STATUS_SEGMENTS.map((segment) => {
            const count = counts[segment.key];
            if (count <= 0 && total > 0) return null;
            const selected = activeStatus === segment.key;
            return (
              <li key={segment.key}>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 ${
                    selected ? "bg-slate-100 font-medium text-slate-900" : "hover:bg-slate-50"
                  }`}
                  onClick={() => onStatusClick?.(segment.key)}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden
                  />
                  {segment.label} <span className="tabular-nums text-slate-500">{count}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 ${
                activeStatus === "all" ? "bg-slate-100 font-medium text-slate-900" : "hover:bg-slate-50"
              }`}
              onClick={() => onStatusClick?.("all")}
            >
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-300" aria-hidden />
              All <span className="tabular-nums text-slate-500">{total}</span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
