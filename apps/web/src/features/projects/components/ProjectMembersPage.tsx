import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchAccessDefaults } from "../../admin/api/adminApi";
import {
  addProjectMember,
  fetchProjectMembers,
  removeProjectMember,
  type ProjectMemberRow,
  updateProjectMemberRole
} from "../api/advancedApi";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";

const roles: ProjectMemberRow["role"][] = ["owner", "manager", "tester", "viewer"];

function projectRoleOrViewer(value: string): ProjectMemberRow["role"] {
  return roles.includes(value as ProjectMemberRow["role"]) ? (value as ProjectMemberRow["role"]) : "viewer";
}

export function ProjectMembersPage() {
  const { projectId = "" } = useParams();
  const [items, setItems] = useState<ProjectMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProjectMemberRow["role"]>("viewer");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProjectMembers(projectId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  useEffect(() => {
    void fetchAccessDefaults()
      .then((row) => setRole(projectRoleOrViewer(row.defaultProjectMemberRole)))
      .catch(() => undefined);
  }, []);

  async function onAdd() {
    if (!email.trim()) return;
    await addProjectMember({ projectId, email, name: name || undefined, role });
    setEmail("");
    setName("");
    void fetchAccessDefaults()
      .then((row) => setRole(projectRoleOrViewer(row.defaultProjectMemberRole)))
      .catch(() => setRole("viewer"));
    await load();
  }

  async function onChangeRole(memberId: string, nextRole: ProjectMemberRow["role"]) {
    await updateProjectMemberRole({ projectId, memberId, role: nextRole });
    await load();
  }

  async function onRemove(memberId: string) {
    await removeProjectMember(projectId, memberId);
    await load();
  }

  if (loading) return <LoadingState message="Loading members…" />;
  if (error) return <ErrorState title="Failed to load project members" message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Built-in roles use the{" "}
        <Link to={`/projects/${projectId}/settings/custom-roles`} className="underline">
          permission matrix
        </Link>
        .
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Add member</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectMemberRow["role"])}
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void onAdd()} className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
            Add
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2">{item.email}</td>
                <td className="px-3 py-2">{item.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    value={item.role}
                    onChange={(e) => void onChangeRole(item.id, e.target.value as ProjectMemberRow["role"])}
                  >
                    {roles.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void onRemove(item.id)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={4}>
                  No members.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
