import "dotenv/config";

export function describeDatabaseUrl(rawUrl: string) {
  if (!rawUrl) return "unset";

  try {
    const url = new URL(rawUrl);
    const port = url.port || "5432";
    const pgbouncer = url.searchParams.get("pgbouncer") ?? "false";
    const sslmode = url.searchParams.get("sslmode") ?? "unset";
    return `${url.hostname}:${port} pgbouncer=${pgbouncer} sslmode=${sslmode}`;
  } catch {
    return "invalid-url";
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "dev-auth-secret",
  useInMemoryRepository: process.env.USE_IN_MEMORY_REPOSITORY !== "false"
};
