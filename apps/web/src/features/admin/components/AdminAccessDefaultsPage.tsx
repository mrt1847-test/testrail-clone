import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import { AppShell } from "../../../shared/ui/AppShell";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchAccessDefaults, updateAccessDefaults, type AccessDefaults } from "../api/adminApi";

const memberRoles: AccessDefaults["defaultProjectMemberRole"][] = ["manager", "tester", "viewer"];
const accessModes: Array<{ value: AccessDefaults["newProjectAccessMode"]; label: string }> = [
  { value: "creator_only", label: "Creator only (owner on new project)" },
  { value: "all_active_users", label: "All active users (default role below)" }
];

export function AdminAccessDefaultsPage() {
  const { user, memberships, logout } = useAuth();
  const canEdit = memberships.some((m) => m.role === "owner") || memberships.length === 0;
  const [defaults, setDefaults] = useState<AccessDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<AccessDefaults["defaultProjectMemberRole"]>("viewer");
  const [accessMode, setAccessMode] = useState<AccessDefaults["newProjectAccessMode"]>("creator_only");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const row = await fetchAccessDefaults();
      setDefaults(row);
      setMemberRole(row.defaultProjectMemberRole);
      setAccessMode(row.newProjectAccessMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load access defaults");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const row = await updateAccessDefaults({
        defaultProjectMemberRole: memberRole,
        newProjectAccessMode: accessMode
      });
      setDefaults(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save access defaults");
    } finally {
      setSaving(false);
    }
  }

  const top = <AdminAccessTopBar userEmail={user?.email} onLogout={() => void logout()} />;

  if (loading) {
    return (
      <AppShell top={top}>
        <LoadingState message="Loading access defaults…" />
      </AppShell>
    );
  }

  if (error && !defaults) {
    return (
      <AppShell top={top}>
        <ErrorState title="Failed to load access defaults" message={error} onRetry={() => void load()} />
      </AppShell>
    );
  }

  return (
    <AppShell top={top}>
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="text-sm text-slate-600">
          Configure how new project members and new projects receive access. Project creators always receive the owner
          role.
        </p>

        {!canEdit ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You need the owner role on at least one project to change these settings. Values below are read-only.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-sm font-medium text-slate-900" htmlFor="default-member-role">
              Default role for new project members
            </label>
            <p className="mt-1 text-xs text-slate-500">Used when inviting a member without choosing a role.</p>
            <select
              id="default-member-role"
              className="mt-2 w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={memberRole}
              disabled={!canEdit || saving}
              onChange={(e) => setMemberRole(e.target.value as AccessDefaults["defaultProjectMemberRole"])}
            >
              {memberRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900" htmlFor="new-project-access">
              New project access
            </label>
            <p className="mt-1 text-xs text-slate-500">Who is added automatically when a project is created.</p>
            <select
              id="new-project-access"
              className="mt-2 w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={accessMode}
              disabled={!canEdit || saving}
              onChange={(e) => setAccessMode(e.target.value as AccessDefaults["newProjectAccessMode"])}
            >
              {accessModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {defaults?.scopeNote ? (
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{defaults.scopeNote}</p>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save defaults"}
            </button>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function AdminAccessTopBar({ userEmail, onLogout }: { userEmail?: string; onLogout: () => void }) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
          <Link to="/projects" className="text-xs text-slate-500 hover:text-slate-700">
            ← Projects
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Instance access defaults</h1>
          <p className="text-xs text-slate-500">{userEmail ?? "unknown"}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
