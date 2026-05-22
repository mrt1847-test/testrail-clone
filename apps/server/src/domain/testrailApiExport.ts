export type ExportedRoute = {
  key: string;
  method: "get" | "post";
  path: string;
  operationId: string;
  summary: string;
  queryParams: Array<{ name: string; description?: string }>;
  pathParams: Array<{ name: string; description: string }>;
};

const PARAM_NAMES: Record<string, string> = {
  project_id: "projectId",
  suite_id: "suiteId",
  section_id: "sectionId",
  case_id: "caseId",
  run_id: "runId",
  test_id: "testId",
  milestone_id: "milestoneId",
  plan_id: "planId",
  config_group_id: "configGroupId",
  config_id: "configurationId",
  report_id: "reportId",
  scenario_id: "scenarioId",
  result_id: "resultId"
};

const LIST_QUERY_PARAMS = [
  { name: "limit", description: "Page size (max 250)." },
  { name: "offset", description: "Page offset." }
];

function toOperationId(action: string) {
  return action.replace(/\//g, "_").replace(/-/g, "_");
}

function pathParamsFromTemplate(template: string) {
  const params: ExportedRoute["pathParams"] = [];
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const raw = match[1]!;
    params.push({
      name: PARAM_NAMES[raw] ?? raw,
      description: `Numeric ${raw.replace(/_/g, " ")}.`
    });
  }
  return params;
}

function resolveHttpPath(template: string) {
  return `/api/v2/${template}`.replace(/\{(\w+)\}/g, (_m, raw: string) => `{${PARAM_NAMES[raw] ?? raw}}`);
}

function queryParamsForPath(httpPath: string, method: "get" | "post") {
  if (method !== "get") return [];
  const params: ExportedRoute["queryParams"] = [];
  if (
    httpPath.includes("/get_cases/") ||
    httpPath.includes("/get_runs/") ||
    httpPath.includes("/get_tests/") ||
    httpPath.includes("/get_results_for_run/")
  ) {
    params.push(...LIST_QUERY_PARAMS);
  }
  if (httpPath.includes("/get_sections/")) {
    params.push({ name: "suite_id", description: "Filter sections by suite." });
  }
  if (httpPath.includes("/get_cases/")) {
    params.push(
      { name: "suite_id", description: "Filter cases by suite." },
      { name: "section_id", description: "Filter cases by section." }
    );
  }
  return params;
}

export function listExportedV2Routes(supported: readonly string[]): ExportedRoute[] {
  return supported.map((entry) => {
    const [methodRaw, ...rest] = entry.split(" ");
    const method = methodRaw === "POST" ? "post" : "get";
    const template = rest.join(" ");
    const httpPath = resolveHttpPath(template);
    return {
      key: entry,
      method,
      path: httpPath,
      operationId: toOperationId(template),
      summary: `TestRail-compatible ${entry}`,
      pathParams: pathParamsFromTemplate(template),
      queryParams: queryParamsForPath(httpPath, method)
    };
  });
}

export function buildTestRailOpenApiDocument(baseUrl: string, supported?: readonly string[]) {
  const routes = listExportedV2Routes(supported);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const parameters = [
      ...route.pathParams.map((param) => ({
        name: param.name,
        in: "path",
        required: true,
        schema: { type: "integer", format: "int64" },
        description: param.description
      })),
      ...route.queryParams.map((param) => ({
        name: param.name,
        in: "query",
        required: false,
        schema: { type: "string" },
        description: param.description
      }))
    ];

    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      summary: route.summary,
      tags: ["TestRail v2"],
      responses: {
        "200": { description: "Success" },
        "400": { description: "Validation error" },
        "401": { description: "Unauthorized" },
        "404": { description: "Not found" }
      }
    };

    if (parameters.length > 0) operation.parameters = parameters;
    if (route.method === "post") {
      operation.requestBody = {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true }
          }
        }
      };
    }

    const existing = paths[route.path] ?? {};
    existing[route.method] = operation;
    paths[route.path] = existing;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "QA Rail TestRail-compatible API",
      version: "1.0.0",
      description:
        "OpenAPI document generated from the implemented /api/v2 surface. See GET /api/v2 for the live supported endpoint index."
    },
    servers: [{ url: baseUrl.replace(/\/$/, "") }],
    tags: [{ name: "TestRail v2", description: "TestRail-compatible adapter routes" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Project API token or user JWT"
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths
  };
}

function postmanRawUrl(route: ExportedRoute) {
  let path = route.path;
  for (const param of route.pathParams) {
    path = path.replace(`{${param.name}}`, `{{${param.name}}}`);
  }
  const queryParts = route.queryParams
    .filter((param) => param.name === "limit" || param.name === "offset")
    .map((param) => `${param.name}=${param.name === "limit" ? "50" : "0"}`);
  const suffix = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  return `{{baseUrl}}${path}${suffix}`;
}

export function buildTestRailPostmanCollection(baseUrl: string, supported?: readonly string[]) {
  const routes = listExportedV2Routes(supported);
  const folders = new Map<string, typeof routes>();

  for (const route of routes) {
    const folder =
      route.path.includes("case") || route.path.includes("scenario")
        ? "Cases & BDD"
        : route.path.includes("run") || route.path.includes("test") || route.path.includes("result")
          ? "Runs & results"
          : route.path.includes("milestone") || route.path.includes("plan") || route.path.includes("config")
            ? "Planning & configs"
            : route.path.includes("suite") || route.path.includes("section")
              ? "Suites & sections"
              : route.path.includes("report") || route.path.includes("user") || route.path.includes("role")
                ? "Reports & admin"
                : "Reference & projects";
    const bucket = folders.get(folder) ?? [];
    bucket.push(route);
    folders.set(folder, bucket);
  }

  const pathVariableNames = new Set<string>();
  for (const route of routes) {
    for (const param of route.pathParams) pathVariableNames.add(param.name);
  }

  return {
    info: {
      name: "QA Rail /api/v2",
      description: "Postman collection for implemented TestRail-compatible endpoints.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
      { key: "baseUrl", value: baseUrl.replace(/\/$/, "") },
      { key: "token", value: "" },
      ...[...pathVariableNames].map((name) => ({
        key: name,
        value: name === "projectId" ? "1" : "1"
      }))
    ],
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{token}}", type: "string" }]
    },
    item: [...folders.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, folderRoutes]) => ({
        name,
        item: folderRoutes.map((route) => ({
          name: route.key,
          request: {
            method: route.method.toUpperCase(),
            header: [{ key: "Content-Type", value: "application/json", disabled: route.method === "get" }],
            url: postmanRawUrl(route),
            auth: {
              type: "bearer",
              bearer: [{ key: "token", value: "{{token}}", type: "string" }]
            },
            body:
              route.method === "post"
                ? {
                    mode: "raw",
                    raw: '{\n  "example": true\n}'
                  }
                : undefined
          }
        }))
      }))
  };
}
