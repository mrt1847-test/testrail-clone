/**
 * Production migration deploy for CI (Render).
 * - Ensures DIRECT_URL is set (required when DATABASE_URL uses a pooler).
 * - Runs `prisma migrate deploy` once from apps/server.
 * - If deploy fails but `migrate status` reports the DB is up to date, exits 0
 *   (avoids failing redeploys when history is already reconciled).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(serverRoot, "prisma", "schema.prisma");

function prismaEnv() {
  const env = { ...process.env };
  if (!env.DIRECT_URL && env.DATABASE_URL) {
    console.warn("[migrate-deploy] DIRECT_URL is not set; using DATABASE_URL for migrations.");
    env.DIRECT_URL = env.DATABASE_URL;
  }
  if (!env.DATABASE_URL) {
    console.error("[migrate-deploy] DATABASE_URL is required.");
    process.exit(1);
  }
  return env;
}

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync("npx", ["prisma", ...args, "--schema", schemaPath], {
    cwd: serverRoot,
    encoding: "utf-8",
    env: prismaEnv()
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output) process.stdout.write(output);
  const code = result.status ?? 1;
  if (code !== 0 && !allowFailure) {
    return { ok: false, code, output };
  }
  return { ok: code === 0, code, output };
}

console.log("[migrate-deploy] Applying pending migrations…");
const deploy = run(["migrate", "deploy"]);
if (deploy.ok) {
  console.log("[migrate-deploy] Done.");
  process.exit(0);
}

console.warn("[migrate-deploy] `migrate deploy` failed; checking status…");
const status = run(["migrate", "status"], { allowFailure: true });

if (deploy.output.includes("P3008")) {
  console.warn(
    "[migrate-deploy] P3008: migration already recorded as applied. " +
      "Do not run `prisma migrate resolve --applied` in the Render build. " +
      "Use only `npm run prisma:deploy -w apps/server` (or render:build:server)."
  );
}

if (status.output.includes("P3009")) {
  console.error(
    "[migrate-deploy] Failed migrations in the database. " +
      "Fix with `prisma migrate resolve` from a shell, then redeploy. " +
      "See https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting"
  );
  process.exit(deploy.code);
}

if (/Database schema is up to date/i.test(status.output)) {
  console.log("[migrate-deploy] Database schema is up to date; continuing build.");
  process.exit(0);
}

if (/following migrations have not yet been applied/i.test(status.output)) {
  console.error("[migrate-deploy] Pending migrations remain. Resolve before deploying.");
}

process.exit(deploy.code);
