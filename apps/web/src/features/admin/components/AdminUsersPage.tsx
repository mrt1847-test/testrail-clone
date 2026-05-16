import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import { AppShell } from "../../../shared/ui/AppShell";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  fetchAdminUsers,
  fetchPermissionMatrix,
  fetchUserGroups,
  type AdminUserRow,
  type PermissionMatrixCatalog,
  type UserGroupRow
} from "../api/adminApi";
import { updateAdminUser } from "../api/adminApi";

export function AdminUsersPage() {
  const { user, memberships, logout } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [groups, setGroups] = useState<UserGroupRow[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrixCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [userRows, groupRows, catalog] = await Promise.all([
      fetchAdminUsers(),
      fetchUserGroups(),
      fetchPermissionMatrix()
    ]);
    setUsers(userRows.data);
    setGroups(groupRows);
    setMatrix(catalog);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onGlobalRoleChange(userId: string, globalRole: string) {
    await updateAdminUser(userId, { globalRole });
    await load();
  }

  return (
    <AppShell
      title="Users & groups"
      userLabel={user?.email}
      onLogout={() => void logout()}
      nav={
        <div className="flex gap-3 text-sm">
          <Link to="/projects" className="text-slate-600 hover:text-slate-900">
            Projects
          </Link>
          <Link to="/admin/access-defaults" className="text-slate-600 hover:text-slate-900">
            Access defaults
          </Link>
        </div>
      }
    >
      {loading ? (
        <LoadingState message="Loading users…" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">User directory</h2>
            <p className="mt-1 text-xs text-slate-500">
              Assign instance-wide <code className="font-mono">instance_admin</code> or per-project roles on the
              members page.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Global role</th>
                    <th className="px-3 py-2">Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          value={row.globalRole}
                          onChange={(e) => void onGlobalRoleChange(row.id, e.target.value)}
                          disabled={!memberships.some((m) => m.role === "owner") && memberships.length > 0}
                        >
                          <option value="user">user</option>
                          <option value="instance_admin">instance_admin</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {row.groups.length > 0 ? row.groups.map((g) => g.name).join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Groups</h2>
            {groups.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No groups yet. Create groups via API for now.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {groups.map((group) => (
                  <li key={group.id} className="rounded border border-slate-100 px-3 py-2">
                    <p className="font-medium">{group.name}</p>
                    <p className="text-xs text-slate-500">{group.members.length} member(s)</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {matrix ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Permission matrix</h2>
              <ul className="mt-2 grid gap-1 text-xs text-slate-700 md:grid-cols-2">
                {matrix.permissions.map((perm) => (
                  <li key={perm.key}>
                    <span className="font-mono text-slate-600">{perm.key}</span> — {perm.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
