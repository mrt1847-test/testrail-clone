import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

execSync("npm run build -w @testrail-clone/shared", {
  cwd: repoRoot,
  stdio: "inherit"
});
