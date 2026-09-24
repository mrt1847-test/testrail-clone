/** Strip quotes/whitespace/trailing slashes from a configured or request origin. */
export function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}

export function parseWebOrigins(raw: string | undefined): string[] {
  const fallback = "http://localhost:5173";
  const origins = (raw ?? fallback)
    .split(",")
    .map((part) => normalizeOrigin(part))
    .filter(Boolean);
  return origins.length > 0 ? origins : [fallback];
}

export function isVercelPreviewOf(allowedOrigin: string, requestOrigin: string): boolean {
  try {
    const allowed = new URL(allowedOrigin);
    const incoming = new URL(requestOrigin);
    if (allowed.protocol !== incoming.protocol) return false;
    if (!allowed.hostname.endsWith(".vercel.app") || !incoming.hostname.endsWith(".vercel.app")) {
      return false;
    }
    const project = allowed.hostname.slice(0, -".vercel.app".length);
    return incoming.hostname === allowed.hostname || incoming.hostname.startsWith(`${project}-`);
  } catch {
    return false;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  if ((process.env.NODE_ENV ?? "development") === "production") return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export function isAllowedWebOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (isLocalDevOrigin(normalized)) return true;
  return allowedOrigins.some(
    (allowed) => allowed === normalized || isVercelPreviewOf(allowed, normalized)
  );
}
