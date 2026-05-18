import { useNavigate } from "react-router-dom";

import type { ProjectActivitySeriesPoint } from "../api/projectApi";
import { buildActivityDrilldownHref } from "../utils/projectActivityDrilldown";

type ProjectActivityLineChartProps = {
  projectId: string;
  days: number;
  points: ProjectActivitySeriesPoint[];
  onDaysChange: (days: number) => void;
};

const timeframes = [7, 14, 30, 60, 90];

function buildPath(values: number[], maxValue: number, width: number, height: number) {
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (maxValue > 0 ? (value / maxValue) * height : 0);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function ProjectActivityLineChart({
  projectId,
  days,
  points,
  onDaysChange
}: ProjectActivityLineChartProps) {
  const navigate = useNavigate();
  const passedValues = points.map((point) => point.passed);
  const failedValues = points.map((point) => point.failed);
  const passedTotal = passedValues.reduce((sum, value) => sum + value, 0);
  const failedTotal = failedValues.reduce((sum, value) => sum + value, 0);
  const total = passedTotal + failedTotal;
  const passedPct = total > 0 ? Math.round((passedTotal / total) * 100) : 0;
  const maxValue = Math.max(1, ...passedValues, ...failedValues);
  const width = 720;
  const height = 180;
  const passedPath = buildPath(passedValues, maxValue, width, height);
  const failedPath = buildPath(failedValues, maxValue, width, height);
  const firstDate = points[0]?.date;
  const lastDate = points[points.length - 1]?.date;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const hitWidth = points.length > 1 ? Math.max(step, 12) : width;

  const drillTo = (input: { date?: string; status?: "passed" | "failed" }) => {
    navigate(buildActivityDrilldownHref(projectId, input));
  };

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Activity</h2>
          <p className="text-sm text-slate-500">
            Passed and failed results over the last {days} days. Click a day or legend to drill down.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {timeframes.map((option) => (
            <button
              key={option}
              type="button"
              className={
                days === option
                  ? "rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                  : "rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              }
              onClick={() => onDaysChange(option)}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => drillTo({ status: "passed" })}
            className="font-medium text-slate-900 hover:underline"
            title="View runs with passed coverage"
          >
            {passedTotal} passed ({passedPct}%)
          </button>
          <button
            type="button"
            onClick={() => drillTo({ status: "failed" })}
            className="font-medium text-slate-900 hover:underline"
            title="View runs with failures"
          >
            {failedTotal} failed
          </button>
          <button
            type="button"
            onClick={() => drillTo({})}
            className="text-xs font-medium text-indigo-800 hover:underline"
          >
            View test runs
          </button>
        </div>
        <div className="overflow-hidden rounded border border-slate-200 bg-slate-50 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Project activity line chart">
            <line x1="0" y1={height} x2={width} y2={height} stroke="#cbd5e1" strokeWidth="1" />
            <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e2e8f0" strokeWidth="1" />
            <path d={passedPath} fill="none" stroke="#3cb850" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />
            <path d={failedPath} fill="none" stroke="#e40046" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />
            {points.map((point, index) => {
              const x = points.length > 1 ? index * step : width / 2;
              return (
                <g key={point.date}>
                  <rect
                    x={x - hitWidth / 2}
                    y={0}
                    width={hitWidth}
                    height={height / 2}
                    fill="transparent"
                    className="cursor-pointer"
                    aria-label={`Passed results on ${point.date}`}
                    onClick={() => drillTo({ date: point.date, status: "passed" })}
                  />
                  <rect
                    x={x - hitWidth / 2}
                    y={height / 2}
                    width={hitWidth}
                    height={height / 2}
                    fill="transparent"
                    className="cursor-pointer"
                    aria-label={`Failed results on ${point.date}`}
                    onClick={() => drillTo({ date: point.date, status: "failed" })}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{firstDate ? formatDate(firstDate) : ""}</span>
          <span className="inline-flex items-center gap-3">
            <button
              type="button"
              onClick={() => drillTo({ status: "passed" })}
              className="inline-flex items-center gap-1 hover:text-slate-800"
            >
              <span className="inline-block h-2 w-4 rounded-sm bg-[#3cb850]" />
              Passed
            </button>
            <button
              type="button"
              onClick={() => drillTo({ status: "failed" })}
              className="inline-flex items-center gap-1 hover:text-slate-800"
            >
              <span className="inline-block h-2 w-4 rounded-sm bg-[#e40046]" />
              Failed
            </button>
          </span>
          <span>{lastDate ? formatDate(lastDate) : ""}</span>
        </div>
      </div>
    </section>
  );
}
