import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  getActivityCompositionCaseLinks,
  getActivityPrimaryHref,
  getActivitySecondaryLinks
} from "../../../shared/activity/activityLinks";
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  snoozeNotification,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationTypeFilter
} from "../api/advancedApi";

type PreferenceKey = keyof NotificationPreferences;

type InboxFilter = "all" | "unread" | NotificationTypeFilter;

const preferenceLabels: Array<{ key: PreferenceKey; label: string; description: string }> = [
  { key: "assignmentEnabled", label: "Assignments", description: "When you are assigned a run or test" },
  {
    key: "activityEnabled",
    label: "Activity on your tests",
    description: "Comments and results on tests assigned to you"
  },
  { key: "failedResultEnabled", label: "Failed results", description: "When a test you own fails" },
  { key: "mentionEnabled", label: "Mentions", description: "When someone @mentions you" },
  { key: "digestEnabled", label: "Email digest", description: "Periodic email summary (when enabled in settings)" }
];

const filterTabs: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "assignment", label: "Assignments" },
  { id: "activity", label: "Activity" },
  { id: "failed_result", label: "Failed" },
  { id: "mention", label: "Mentions" }
];

function listFilters(filter: InboxFilter, includeSnoozed: boolean) {
  return {
    unreadOnly: filter === "unread",
    type: filter === "all" || filter === "unread" ? undefined : filter,
    includeSnoozed
  };
}

function typeLabel(type: string) {
  switch (type) {
    case "assignment":
      return "Assignment";
    case "failed_result":
      return "Failed result";
    case "mention":
      return "Mention";
    case "activity":
      return "Activity";
    default:
      return type;
  }
}

export function NotificationsPage() {
  const { projectId = "" } = useParams();
  const [page, setPage] = useState(1);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [includeSnoozed, setIncludeSnoozed] = useState(false);
  const queryClient = useQueryClient();
  const filters = listFilters(inboxFilter, includeSnoozed);
  const queryKey = ["notifications", projectId, page, filters];
  const preferencesKey = ["notification-preferences", projectId];

  useEffect(() => {
    setPage(1);
  }, [inboxFilter, includeSnoozed]);

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(projectId, page, 25, filters),
    enabled: Boolean(projectId)
  });

  const preferencesQuery = useQuery({
    queryKey: preferencesKey,
    queryFn: () => fetchNotificationPreferences(projectId),
    enabled: Boolean(projectId)
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(projectId, notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", projectId] })
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", projectId] })
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ notificationId, hours }: { notificationId: string; hours: number }) =>
      snoozeNotification(projectId, notificationId, hours),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", projectId] })
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) => updateNotificationPreferences(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: preferencesKey })
  });

  if (notificationsQuery.isLoading) return <LoadingState message="Loading notifications..." />;
  if (notificationsQuery.isError) {
    return <ErrorState title="Could not load notifications" onRetry={() => notificationsQuery.refetch()} />;
  }

  const rows = notificationsQuery.data?.items ?? [];
  const preferences = preferencesQuery.data;
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Inbox</h1>
          <p className="text-sm text-slate-600">
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"} (snoozed items excluded from count).
          </p>
        </div>
        <button
          type="button"
          disabled={unreadCount === 0 || markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {markAllMutation.isPending ? "Marking…" : "Mark all read"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setInboxFilter(tab.id)}
            className={
              inboxFilter === tab.id
                ? "border-b-2 border-slate-900 px-3 py-2 text-sm font-medium text-slate-900"
                : "px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            }
          >
            {tab.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={includeSnoozed}
            onChange={(e) => setIncludeSnoozed(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          Show snoozed
        </label>
      </div>

      {preferences ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Mute categories</h2>
          <p className="mt-1 text-xs text-slate-500">
            Turn off categories to stop new inbox items and immediate emails for this project.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {preferenceLabels.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(event) => updatePreferencesMutation.mutate({ [item.key]: event.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium text-slate-900">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={
            inboxFilter === "unread"
              ? "You have no unread notifications in this view."
              : "Assignments, activity on your tests, failed results, and mentions will appear here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => {
              const activity = row.activity;
              const target = activity
                ? {
                    entityType: activity.entityType,
                    entityId: activity.entityId,
                    eventType: activity.eventType,
                    payload: activity.payload
                  }
                : null;
              const primaryHref = target ? getActivityPrimaryHref(projectId, target) : null;
              const secondaryLinks = target ? getActivitySecondaryLinks(projectId, target) : [];
              const caseLinks = target ? getActivityCompositionCaseLinks(projectId, target) : [];
              const isSnoozed = row.snoozedUntil && new Date(row.snoozedUntil) > new Date();
              const openLabel =
                activity?.eventType === "test.assigned" || activity?.eventType === "run.assigned"
                  ? "Open test"
                  : activity?.eventType === "run.tests_added" || activity?.eventType === "run.test_removed"
                    ? "Open run"
                    : "Open source";
              return (
                <li
                  key={row.id}
                  className={row.readAt ? "px-4 py-3" : isSnoozed ? "bg-amber-50/60 px-4 py-3" : "bg-slate-50 px-4 py-3"}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          {typeLabel(row.type)}
                        </span>
                        {!row.readAt ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-800">
                            Unread
                          </span>
                        ) : null}
                        {isSnoozed ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                            Snoozed until {new Date(row.snoozedUntil!).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      {row.body ? <p className="mt-1 text-sm text-slate-600">{row.body}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {primaryHref ? (
                          <Link to={primaryHref} className="text-xs font-medium text-slate-700 underline">
                            {openLabel}
                          </Link>
                        ) : null}
                        {secondaryLinks.map((link) => (
                          <Link key={link.href} to={link.href} className="text-xs font-medium text-slate-600 underline">
                            {link.label}
                          </Link>
                        ))}
                        {caseLinks.map((link) => (
                          <Link key={link.caseId} to={link.href} className="text-xs text-slate-600 underline">
                            Case {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!row.readAt ? (
                        <button
                          type="button"
                          onClick={() => markReadMutation.mutate(row.id)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Mark read
                        </button>
                      ) : null}
                      <select
                        aria-label="Snooze notification"
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
                        defaultValue=""
                        disabled={snoozeMutation.isPending}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") return;
                          snoozeMutation.mutate({ notificationId: row.id, hours: Number(value) });
                          e.target.value = "";
                        }}
                      >
                        <option value="">Snooze…</option>
                        <option value="1">1 hour</option>
                        <option value="24">1 day</option>
                        <option value="168">1 week</option>
                        {isSnoozed ? <option value="0">Clear snooze</option> : null}
                      </select>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-600">
              Page {notificationsQuery.data?.page ?? 1} of {notificationsQuery.data?.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (notificationsQuery.data?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
