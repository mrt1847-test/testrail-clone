import { useState } from "react";
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
  updateNotificationPreferences,
  type NotificationPreferences
} from "../api/advancedApi";

type PreferenceKey = keyof NotificationPreferences;

const preferenceLabels: Array<{ key: PreferenceKey; label: string }> = [
  { key: "assignmentEnabled", label: "Assignments" },
  { key: "activityEnabled", label: "Comments & results on your tests" },
  { key: "failedResultEnabled", label: "Failed results" },
  { key: "mentionEnabled", label: "Mentions" },
  { key: "digestEnabled", label: "Digest" }
];

export function NotificationsPage() {
  const { projectId = "" } = useParams();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const queryKey = ["notifications", projectId, page];
  const preferencesKey = ["notification-preferences", projectId];

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(projectId, page, 25),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-600">
            {notificationsQuery.data?.unreadCount ?? 0} unread project notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllMutation.mutate()}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Mark all read
        </button>
      </div>

      {preferences ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Preferences</h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {preferenceLabels.map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(event) => updatePreferencesMutation.mutate({ [item.key]: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Assignments, comments and results on your tests, failed results, and mentions will appear here."
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
              const openLabel =
                activity?.eventType === "test.assigned" || activity?.eventType === "run.assigned"
                  ? "Open test"
                  : activity?.eventType === "run.tests_added" || activity?.eventType === "run.test_removed"
                    ? "Open run"
                    : "Open source";
              return (
              <li key={row.id} className={row.readAt ? "px-4 py-3" : "bg-slate-50 px-4 py-3"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{row.title}</p>
                    {row.body ? <p className="mt-1 text-sm text-slate-600">{row.body}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {row.type} - {new Date(row.createdAt).toLocaleString()}
                    </p>
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
                  {!row.readAt ? (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(row.id)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Mark read
                    </button>
                  ) : null}
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
