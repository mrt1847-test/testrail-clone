const ROLE_HEADER = "x-project-role";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type FetchOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** 변경 API용. 기본 `manager`. */
  role?: string;
};

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, role = "manager" } = options;
  const headers: Record<string, string> = { [ROLE_HEADER]: role };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
