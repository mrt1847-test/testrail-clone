import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchPermissionMatrix } from "../../admin/api/adminApi";
import { createCustomRole, deleteCustomRole, fetchCustomRoles, type CustomRoleRow } from "../api/advancedApi";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";

export function ProjectCustomRolesPage() {
  const { projectId = "" } = useParams();
  const [roles, setRoles] = useState<CustomRoleRow[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["cases.read", "cases.write"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [roleRows, matrix] = await Promise.all([fetchCustomRoles(projectId), fetchPermissionMatrix()]);
      setRoles(roleRows);
      setPermissionOptions(matrix.permissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load custom roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function onCreate() {
    if (!name.trim() || selectedPermissions.length === 0) return;
    await createCustomRole(projectId, { name: name.trim(), permissions: selectedPermissions });
    setName("");
    await load();
  }

  if (loading) return <LoadingState message="Loading custom roles…" />;
  if (error) return <ErrorState title="Custom roles" message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Create custom role</h2>
        <p className="mt-1 text-xs text-slate-500">
          Custom roles override built-in role permissions when assigned to a member.
        </p>
        <div className="mt-3 space-y-3">
          <input
            className="w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <fieldset>
            <legend className="text-xs font-medium uppercase text-slate-500">Permissions</legend>
            <ul className="mt-2 grid gap-1 md:grid-cols-2">
              {permissionOptions.map((perm) => (
                <li key={perm.key}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.key)}
                      onChange={() =>
                        setSelectedPermissions((current) =>
                          current.includes(perm.key)
                            ? current.filter((item) => item !== perm.key)
                            : [...current, perm.key]
                        )
                      }
                    />
                    <span>
                      <span className="font-mono text-xs">{perm.key}</span>
                      <span className="block text-xs text-slate-500">{perm.label}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <button
            type="button"
            onClick={() => void onCreate()}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Create role
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Project custom roles</h2>
        {roles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No custom roles.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {roles.map((role) => (
              <li key={role.id} className="flex items-start justify-between gap-3 rounded border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{role.name}</p>
                  <p className="font-mono text-xs text-slate-500">{role.systemName}</p>
                  <p className="mt-1 text-xs text-slate-600">{role.permissions.join(", ")}</p>
                </div>
                <button
                  type="button"
                  className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                  onClick={() => void deleteCustomRole(projectId, role.id).then(load)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
