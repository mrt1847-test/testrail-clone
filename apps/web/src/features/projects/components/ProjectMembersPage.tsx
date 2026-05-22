import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchAccessDefaults } from "../../admin/api/adminApi";
import {
  addProjectMember,
  fetchProjectMembers,
  removeProjectMember,
  type ProjectMemberRow,
  updateProjectMemberRole
} from "../api/advancedApi";
import { Button, DataTable, Panel, useToast, type DataTableColumn } from "../../../shared/ui";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";

const roles: ProjectMemberRow["role"][] = ["owner", "manager", "tester", "viewer"];

function projectRoleOrViewer(value: string): ProjectMemberRow["role"] {
  return roles.includes(value as ProjectMemberRow["role"]) ? (value as ProjectMemberRow["role"]) : "viewer";
}

export function ProjectMembersPage() {
  const { projectId = "" } = useParams();
  const { showToast } = useToast();
  const [items, setItems] = useState<ProjectMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProjectMemberRow["role"]>("viewer");
  const [adding, setAdding] = useState(false);

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
    setAdding(true);
    try {
      await addProjectMember({ projectId, email, name: name || undefined, role });
      setEmail("");
      setName("");
      void fetchAccessDefaults()
        .then((row) => setRole(projectRoleOrViewer(row.defaultProjectMemberRole)))
        .catch(() => setRole("viewer"));
      showToast("Member added", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not add member", "error");
    } finally {
      setAdding(false);
    }
  }

  async function onChangeRole(memberId: string, nextRole: ProjectMemberRow["role"]) {
    try {
      await updateProjectMemberRole({ projectId, memberId, role: nextRole });
      showToast("Role updated", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update role", "error");
    }
  }

  async function onRemove(memberId: string) {
    try {
      await removeProjectMember(projectId, memberId);
      showToast("Member removed", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not remove member", "error");
    }
  }

  const columns = useMemo<DataTableColumn<ProjectMemberRow>[]>(
    () => [
      { key: "email", header: "Email", cell: (row) => row.email },
      { key: "name", header: "Name", cell: (row) => row.name ?? "—" },
      {
        key: "role",
        header: "Role",
        cell: (row) => (
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
            value={row.role}
            onChange={(e) => void onChangeRole(row.id, e.target.value as ProjectMemberRow["role"])}
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )
      },
      {
        key: "actions",
        header: "Actions",
        cell: (row) => (
          <Button variant="danger" size="sm" onClick={() => void onRemove(row.id)}>
            Remove
          </Button>
        )
      }
    ],
    []
  );

  if (loading) return <LoadingState message="Loading members…" />;
  if (error) return <ErrorState title="Failed to load project members" message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Built-in roles use the{" "}
        <Link to={`/projects/${projectId}/settings/custom-roles`} className="underline">
          permission matrix
        </Link>
        .
      </p>
      <Panel title="Add member">
        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectMemberRow["role"])}
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button loading={adding} onClick={() => void onAdd()}>
            Add
          </Button>
        </div>
      </Panel>

      <DataTable columns={columns} rows={items} rowKey={(row) => row.id} emptyMessage="No members." />
    </div>
  );
}
