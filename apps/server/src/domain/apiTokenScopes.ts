export const API_TOKEN_SCOPES = [
  "automation:read",
  "automation:write",
  "data:read",
  "data:write"
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export const API_TOKEN_SCOPE_LABELS: Record<ApiTokenScope, string> = {
  "automation:read": "Automation read (upload history, mappings)",
  "automation:write": "Automation write (submit results, create runs)",
  "data:read": "Data read (TestRail-compatible GET /api/v2)",
  "data:write": "Data write (TestRail-compatible mutations /api/v2)"
};

export const API_TOKEN_DEFAULT_SCOPES: ApiTokenScope[] = ["automation:read", "automation:write"];

export const API_TOKEN_EXPIRY_PRESETS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" }
] as const;

export function isApiTokenScope(value: string): value is ApiTokenScope {
  return (API_TOKEN_SCOPES as readonly string[]).includes(value);
}

export function normalizeApiTokenScopes(scopes: string[] | undefined): ApiTokenScope[] {
  if (!scopes || scopes.length === 0) return [...API_TOKEN_DEFAULT_SCOPES];
  const normalized: ApiTokenScope[] = [];
  for (const scope of scopes) {
    if (!isApiTokenScope(scope)) continue;
    if (!normalized.includes(scope)) normalized.push(scope);
  }
  if (normalized.length === 0) return [...API_TOKEN_DEFAULT_SCOPES];
  return normalized;
}

export function tokenHasScopes(tokenScopes: string[], required: ApiTokenScope | ApiTokenScope[]): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((scope) => tokenScopes.includes(scope));
}

export function computeTokenExpiresAt(expiresInDays: number | null | undefined): Date | null {
  if (expiresInDays == null || expiresInDays <= 0) return null;
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);
  return expiresAt;
}

export function isTokenExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}
