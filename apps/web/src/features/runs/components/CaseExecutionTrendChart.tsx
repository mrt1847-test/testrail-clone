import { useMemo } from "react";

import type { CaseExecutionHistoryItem } from "../types";

const STATUS_COLOR: Record<string, string> = {
  passed: "#16a34a",
  failed: "#dc2626",
  blocked: "#d97706",
  retest: "#7c3aed",
  untested: "#94a3b8"
};

type Props = {
  items: CaseExecutionHistoryItem[];
  width?: number;
  height?: number;
  className?: string;
};

export function CaseExecutionTrendChart({ items, width = 280, height = 56, className = "" }: Props) {
  const points = useMemo(() => {
    const sorted = [...items].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
    if (sorted.length === 0) return [];
    const padX = 8;
    const usable = width - padX * 2;
    const step = sorted.length > 1 ? usable / (sorted.length - 1) : 0;
    return sorted.map((item, index) => ({
      item,
      x: padX + step * index,
      y: height / 2
    }));
  }, [height, items, width]);

  if (points.length === 0) {
    return (
      <p className={`text-xs text-slate-500 ${className}`}>No prior executions in this project yet.</p>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Case execution trend across runs"
    >
      <line x1={8} y1={height / 2} x2={width - 8} y2={height / 2} stroke="#e2e8f0" strokeWidth={1} />
      {points.length > 1
        ? points.slice(1).map((point, index) => {
            const prev = points[index];
            return (
              <line
                key={`${point.item.resultId}-seg`}
                x1={prev.x}
                y1={prev.y}
                x2={point.x}
                y2={point.y}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
            );
          })
        : null}
      {points.map((point) => (
        <circle
          key={point.item.resultId}
          cx={point.x}
          cy={point.y}
          r={5}
          fill={STATUS_COLOR[point.item.status] ?? "#64748b"}
        >
          <title>
            {point.item.runName} — {point.item.status} ({new Date(point.item.createdAt).toLocaleString()})
          </title>
        </circle>
      ))}
    </svg>
  );
}
