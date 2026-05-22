import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
};

const projectId = getArg("--projectId", "1");
const runId = getArg("--runId", "1");
const date = getArg("--date", new Date().toISOString().slice(0, 10));
const origin = getArg("--origin", "http://localhost:5173");
const outDir = join("docs", "artifacts", "ux-screenshots", date);

const routes = [
  { key: "overview", path: `/projects/${projectId}`, layout: "workbench" },
  { key: "cases", path: `/projects/${projectId}/cases`, layout: "split-pane" },
  { key: "run-list", path: `/projects/${projectId}/runs`, layout: "workbench" },
  { key: "run-detail", path: `/projects/${projectId}/runs/${runId}`, layout: "split-pane" },
  { key: "my-tests", path: `/projects/${projectId}/my-tests`, layout: "table" },
  { key: "milestones", path: `/projects/${projectId}/milestones`, layout: "workbench" },
  { key: "plans", path: `/projects/${projectId}/plans`, layout: "workbench" },
  { key: "reports", path: `/projects/${projectId}/reports`, layout: "report-config" }
];

const viewports = [
  { key: "desktop", size: "1440x1000" },
  { key: "narrow", size: "390x844" }
];

mkdirSync(outDir, { recursive: true });

const lines = [
  `# UX Screenshot Capture - ${date}`,
  "",
  `Origin: ${origin}`,
  `Project ID: ${projectId}`,
  `Run ID: ${runId}`,
  "",
  "Follow `docs/UX_GATE.md` while capturing these routes.",
  "",
  "| Route | Layout | Viewport | URL | File |",
  "|-------|--------|----------|-----|------|"
];

for (const route of routes) {
  for (const viewport of viewports) {
    const file = `${route.key}-${viewport.key}.png`;
    lines.push(`| ${route.key} | ${route.layout} | ${viewport.size} | ${origin}${route.path} | ${file} |`);
  }
}

lines.push(
  "",
  "PR checklist:",
  "",
  "- [ ] Desktop and narrow screenshots are captured for touched routes.",
  "- [ ] Section tree placement is unchanged for case repository captures.",
  "- [ ] URL state and selected panes survive navigation and viewport changes.",
  "- [ ] Screenshot folder is linked in the PR."
);

writeFileSync(join(outDir, "README.md"), `${lines.join("\n")}\n`, "utf8");
console.log(`Prepared UX screenshot manifest: ${join(outDir, "README.md")}`);
