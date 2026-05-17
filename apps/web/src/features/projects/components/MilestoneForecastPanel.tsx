import type { MilestoneForecast } from "../api/milestoneSummaryApi";
import { MilestoneScheduleBadge } from "./MilestoneScheduleBadge";

type MilestoneForecastPanelProps = {
  forecast: MilestoneForecast;
  title?: string;
};

export function MilestoneForecastPanel({ forecast, title = "Forecast & burndown" }: MilestoneForecastPanelProps) {
  const maxRemaining = Math.max(
    1,
    ...forecast.burndown.map((point) => point.idealRemaining),
    forecast.remainingTests
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
        <MilestoneScheduleBadge status={forecast.scheduleStatus} />
      </div>
      <p className="mt-2 text-sm text-slate-700">{forecast.hint}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase text-slate-500">Remaining</dt>
          <dd className="font-medium text-slate-900">{forecast.remainingTests}</dd>
        </div>
        {forecast.velocityPerDay != null ? (
          <div>
            <dt className="text-xs uppercase text-slate-500">Velocity</dt>
            <dd className="font-medium text-slate-900">{forecast.velocityPerDay} passed/day</dd>
          </div>
        ) : null}
        {forecast.daysRemaining != null ? (
          <div>
            <dt className="text-xs uppercase text-slate-500">Days left</dt>
            <dd className="font-medium text-slate-900">{forecast.daysRemaining}</dd>
          </div>
        ) : null}
        {forecast.projectedCompletionDate ? (
          <div>
            <dt className="text-xs uppercase text-slate-500">Projected end</dt>
            <dd className="font-medium text-slate-900">
              {new Date(forecast.projectedCompletionDate).toLocaleDateString()}
            </dd>
          </div>
        ) : null}
      </dl>
      {forecast.burndown.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-slate-500">Burndown (remaining tests)</p>
          <div className="mt-2 flex items-end gap-0.5 overflow-x-auto pb-1">
            {forecast.burndown.map((point) => {
              const idealHeight = Math.max(4, Math.round((point.idealRemaining / maxRemaining) * 72));
              const actualHeight =
                point.actualRemaining != null
                  ? Math.max(4, Math.round((point.actualRemaining / maxRemaining) * 72))
                  : 0;
              return (
                <div key={point.date} className="flex min-w-[10px] flex-col items-center gap-0.5" title={point.date}>
                  <div className="flex h-[76px] items-end gap-px">
                    <div
                      className="w-1.5 rounded-t bg-slate-300"
                      style={{ height: `${idealHeight}px` }}
                      title={`Ideal ${point.idealRemaining}`}
                    />
                    {point.actualRemaining != null ? (
                      <div
                        className="w-1.5 rounded-t bg-indigo-600"
                        style={{ height: `${actualHeight}px` }}
                        title={`Actual ${point.actualRemaining}`}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gray = ideal burndown · Indigo = today&apos;s remaining work
          </p>
        </div>
      ) : null}
    </section>
  );
}
