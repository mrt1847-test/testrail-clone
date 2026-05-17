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
  useInMemoryRepository: process.env.USE_IN_MEMORY_REPOSITORY !== "false",
  /** console (default) | smtp | disabled */
  emailDeliveryMode: (process.env.EMAIL_DELIVERY_MODE ?? "console") as "console" | "smtp" | "disabled",
  emailFrom: process.env.EMAIL_FROM ?? "notifications@testrail-clone.local",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  /** Base URL used for signed upload/download links (Supabase Storage or reverse proxy). */
  storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? "https://storage.local",
  storageSignedUrlTtlSeconds: Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? 600),
  storageUploadUrlTtlSeconds: Number(process.env.STORAGE_UPLOAD_URL_TTL_SECONDS ?? 600),
  attachmentRetentionDaysDefault: Number(process.env.ATTACHMENT_RETENTION_DAYS_DEFAULT ?? 90),
  attachmentRetentionMinDays: Number(process.env.ATTACHMENT_RETENTION_MIN_DAYS ?? 30),
  attachmentRetentionMaxDays: Number(process.env.ATTACHMENT_RETENTION_MAX_DAYS ?? 3650),
  attachmentRetentionPruneBatchSize: Number(process.env.ATTACHMENT_RETENTION_PRUNE_BATCH_SIZE ?? 200)
};
