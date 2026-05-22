export type ApiDocEndpoint = {
  key: string;
  method: "GET" | "POST";
  path: string;
  category: string;
  description: string;
  curl: string;
};

type BuildContext = {
  baseUrl: string;
  projectId: string;
};

const PLACEHOLDER_IDS: Record<string, string> = {
  project_id: "PROJECT_ID",
  suite_id: "SUITE_ID",
  section_id: "SECTION_ID",
  case_id: "CASE_ID",
  run_id: "RUN_ID",
  test_id: "TEST_ID",
  milestone_id: "MILESTONE_ID",
  plan_id: "PLAN_ID",
  config_group_id: "CONFIG_GROUP_ID",
  config_id: "CONFIG_ID",
  report_id: "REPORT_ID",
  scenario_id: "SCENARIO_ID",
  result_id: "RESULT_ID"
};

const CATEGORY_RULES: Array<{ prefix: string; category: string }> = [
  { prefix: "get_project", category: "Projects" },
  { prefix: "get_suite", category: "Suites & sections" },
  { prefix: "get_section", category: "Suites & sections" },
  { prefix: "add_section", category: "Suites & sections" },
  { prefix: "update_section", category: "Suites & sections" },
  { prefix: "delete_section", category: "Suites & sections" },
  { prefix: "add_suite", category: "Suites & sections" },
  { prefix: "update_suite", category: "Suites & sections" },
  { prefix: "get_case", category: "Cases" },
  { prefix: "add_case", category: "Cases" },
  { prefix: "update_case", category: "Cases" },
  { prefix: "get_scenario", category: "BDD scenarios" },
  { prefix: "add_scenario", category: "BDD scenarios" },
  { prefix: "update_scenario", category: "BDD scenarios" },
  { prefix: "delete_scenario", category: "BDD scenarios" },
  { prefix: "get_bdd", category: "BDD scenarios" },
  { prefix: "add_bdd", category: "BDD scenarios" },
  { prefix: "update_bdd", category: "BDD scenarios" },
  { prefix: "delete_bdd", category: "BDD scenarios" },
  { prefix: "get_run", category: "Runs & results" },
  { prefix: "add_run", category: "Runs & results" },
  { prefix: "update_run", category: "Runs & results" },
  { prefix: "close_run", category: "Runs & results" },
  { prefix: "get_test", category: "Runs & results" },
  { prefix: "get_result", category: "Runs & results" },
  { prefix: "add_result", category: "Runs & results" },
  { prefix: "get_milestone", category: "Milestones & plans" },
  { prefix: "add_milestone", category: "Milestones & plans" },
  { prefix: "update_milestone", category: "Milestones & plans" },
  { prefix: "get_plan", category: "Milestones & plans" },
  { prefix: "add_plan", category: "Milestones & plans" },
  { prefix: "update_plan", category: "Milestones & plans" },
  { prefix: "get_config", category: "Configurations" },
  { prefix: "add_config", category: "Configurations" },
  { prefix: "update_config", category: "Configurations" },
  { prefix: "get_report", category: "Reports & catalog" },
  { prefix: "run_report", category: "Reports & catalog" },
  { prefix: "get_attachment", category: "Attachments" },
  { prefix: "get_shared", category: "Shared steps" },
  { prefix: "get_label", category: "Labels & groups" },
  { prefix: "get_group", category: "Labels & groups" },
  { prefix: "get_user", category: "Users & roles" },
  { prefix: "get_role", category: "Users & roles" },
  { prefix: "get_status", category: "Reference data" },
  { prefix: "get_case_type", category: "Reference data" },
  { prefix: "get_priorit", category: "Reference data" },
  { prefix: "get_dataset", category: "Reference data" },
  { prefix: "get_variable", category: "Reference data" },
  { prefix: "get_field", category: "Reference data" },
  { prefix: "get_template", category: "Reference data" }
];

function categoryForAction(action: string) {
  const hit = CATEGORY_RULES.find((rule) => action.startsWith(rule.prefix));
  return hit?.category ?? "Other";
}

function resolvePath(template: string, ctx: BuildContext) {
  return `/api/v2/${template}`.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (key === "project_id") return ctx.projectId;
    const placeholder = PLACEHOLDER_IDS[key];
    return placeholder ? `$${placeholder}` : "1";
  });
}

function queryForPath(path: string, ctx: BuildContext) {
  if (path.includes("/get_sections/")) {
    return `?suite_id=$${PLACEHOLDER_IDS.suite_id}`;
  }
  if (path.includes("/get_cases/")) {
    return `?suite_id=$${PLACEHOLDER_IDS.suite_id}&limit=50&offset=0`;
  }
  if (path.includes("/get_runs/") || path.includes("/get_tests/")) {
    return "?limit=25&offset=0";
  }
  if (path.includes("/get_results_for_run/")) {
    return "?limit=25&offset=0";
  }
  if (path.endsWith(`/get_sections/${ctx.projectId}`)) {
    return `?suite_id=$${PLACEHOLDER_IDS.suite_id}`;
  }
  return "";
}

function bodyForPost(path: string) {
  if (path.includes("/add_case/")) {
    return `  -d '{\n    "title": "Guest can check out",\n    "priority": "high",\n    "caseType": "regression"\n  }'`;
  }
  if (path.includes("/add_run/")) {
    return `  -d '{\n    "suite_id": "$${PLACEHOLDER_IDS.suite_id}",\n    "name": "API smoke run",\n    "include_all": true\n  }'`;
  }
  if (path.includes("/add_results_for_cases/")) {
    return `  -d '{\n    "results": [\n      { "case_id": 101, "status_id": 1, "comment": "passed", "elapsed": "5s" }\n    ]\n  }'`;
  }
  if (path.includes("/add_result_for_case/")) {
    return `  -d '{\n    "status_id": 1,\n    "comment": "passed via API",\n    "elapsed": "5s"\n  }'`;
  }
  if (path.includes("/add_milestone/")) {
    return `  -d '{\n    "name": "Release 1.0",\n    "start_on": null,\n    "due_on": null\n  }'`;
  }
  if (path.includes("/add_plan/")) {
    return `  -d '{\n    "name": "Regression plan" }'`;
  }
  if (path.includes("/close_run/")) {
    return "";
  }
  if (path.includes("/run_report/")) {
    return `  -d '{\n    "format": "csv",\n    "scope": "project"\n  }'`;
  }
  if (path.includes("/add_scenario/") || path.includes("/add_bdd_scenario/")) {
    return `  -d '{\n    "name": "Happy path",\n    "content": "Given ..."\n  }'`;
  }
  if (path.includes("/update_")) {
    return `  -d '{\n    "name": "Updated via API"\n  }'`;
  }
  return "";
}

function needsAuth(method: string, path: string) {
  if (method === "GET" && (path === "/api/v2" || path.endsWith("/get_projects"))) return false;
  if (method === "GET" && path.match(/\/get_(case_types|priorities|case_statuses|statuses|groups)$/)) {
    return false;
  }
  return true;
}

function buildCurl(method: "GET" | "POST", path: string, ctx: BuildContext) {
  const query = method === "GET" ? queryForPath(path, ctx) : "";
  const url = `${ctx.baseUrl}${path}${query}`;
  const lines = [`curl -sS -X ${method} "${url}"`];
  if (needsAuth(method, path.split("?")[0] ?? path)) {
    lines.push('  -H "Authorization: Bearer $QA_RAIL_TOKEN"');
  }
  if (method === "POST") {
    lines.push('  -H "Content-Type: application/json"');
    const body = bodyForPost(path);
    if (body) lines.push(body);
  }
  return lines.join(" \\\n");
}

function descriptionFor(action: string, method: string) {
  const verb = method === "GET" ? "Read" : "Write";
  return `${verb} via TestRail-compatible \`${action}\`.`;
}

export function buildEndpointFromSupported(supported: string, ctx: BuildContext): ApiDocEndpoint {
  const [methodRaw, ...rest] = supported.split(" ");
  const method = (methodRaw === "POST" ? "POST" : "GET") as "GET" | "POST";
  const action = rest.join(" ");
  const path = resolvePath(action, ctx);
  return {
    key: supported,
    method,
    path,
    category: categoryForAction(action),
    description: descriptionFor(action, method),
    curl: buildCurl(method, path, ctx)
  };
}

export function buildAutomationDocEntries(ctx: BuildContext): ApiDocEndpoint[] {
  return [
    {
      key: "automation-bulk",
      method: "POST",
      path: "/api/automation/results/bulk",
      category: "Automation API",
      description: "Upload many automation results into an existing run (CI-friendly).",
      curl: [
        `curl -sS -X POST "${ctx.baseUrl}/api/automation/results/bulk"`,
        '  -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN"',
        '  -H "Content-Type: application/json"',
        `  -d '{\n    "runId": "$${PLACEHOLDER_IDS.run_id}",\n    "atomic": false,\n    "results": [\n      { "case_id": 101, "status": "passed", "comment": "CI passed", "elapsed": "12s" }\n    ]\n  }'`
      ].join(" \\\n")
    },
    {
      key: "automation-run",
      method: "POST",
      path: "/api/automation/runs",
      category: "Automation API",
      description: "Create a run for automation uploads when CI owns run creation.",
      curl: [
        `curl -sS -X POST "${ctx.baseUrl}/api/automation/runs"`,
        '  -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN"',
        '  -H "Content-Type: application/json"',
        `  -d '{\n    "projectId": "${ctx.projectId}",\n    "suiteId": "$${PLACEHOLDER_IDS.suite_id}",\n    "name": "CI regression",\n    "includeAll": true\n  }'`
      ].join(" \\\n")
    },
    {
      key: "v2-index",
      method: "GET",
      path: "/api/v2",
      category: "Discovery",
      description: "List supported and deferred TestRail-compatible endpoints.",
      curl: `curl -sS "${ctx.baseUrl}/api/v2" | jq`
    }
  ];
}

export function buildAllApiDocEndpoints(supported: string[], ctx: BuildContext): ApiDocEndpoint[] {
  const v2 = supported.map((entry) => buildEndpointFromSupported(entry, ctx));
  return [...buildAutomationDocEntries(ctx), ...v2];
}

export function groupEndpointsByCategory(endpoints: ApiDocEndpoint[]) {
  const groups = new Map<string, ApiDocEndpoint[]>();
  for (const endpoint of endpoints) {
    const rows = groups.get(endpoint.category) ?? [];
    rows.push(endpoint);
    groups.set(endpoint.category, rows);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
