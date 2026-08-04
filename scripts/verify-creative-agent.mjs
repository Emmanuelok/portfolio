import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const AGENT_PATH = "src/lib/workspace/agent.ts";
const ROUTE_PATH = "src/app/api/workspace/agent/route.ts";
const TYPES_PATH = "src/lib/workspace/types.ts";
const LOCAL_ANALYSIS_PATH = "src/lib/workspace/local-analysis.ts";
const CORPUS_PATH = "evals/creative-agent/corpus.json";
const WORKFLOW_PATH = ".github/workflows/creative-agent-daily.yml";
const CATALOG_URL = "https://ai-gateway.vercel.sh/v1/models";

function reportDirectory() {
  const argumentIndex = process.argv.indexOf("--report-dir");
  if (argumentIndex >= 0 && process.argv[argumentIndex + 1]) {
    return path.resolve(ROOT, process.argv[argumentIndex + 1]);
  }
  if (process.env.CREATIVE_AGENT_REPORT_DIR) {
    return path.resolve(process.env.CREATIVE_AGENT_REPORT_DIR);
  }
  return path.join(tmpdir(), "kingxford-creative-agent-evaluation");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isEnabled(value) {
  return ["1", "true", "yes"].includes(String(value || "").toLowerCase());
}

function extract(source, expression, label) {
  const match = source.match(expression);
  if (!match?.[1]) throw new Error(`Could not read ${label}.`);
  return match[1];
}

function check(id, group, passed, detail, evidence) {
  return {
    id,
    group,
    status: passed ? "pass" : "fail",
    detail,
    ...(evidence ? { evidence } : {}),
  };
}

function warning(id, detail) {
  return { id, group: "catalog", status: "warning", detail };
}

function validateCorpus(corpus, checks) {
  const requiredTags = [
    "baseline",
    "code-boundary",
    "mindmap",
    "prompt-injection",
    "high-stakes",
    "age-appropriate",
    "secret-handling",
  ];
  const modes = new Set(corpus.cases.map((entry) => entry.mode));
  const agentRoles = new Set(corpus.cases.map((entry) => entry.agentRole));
  const ids = corpus.cases.map((entry) => entry.id);
  const tags = new Set(corpus.cases.flatMap((entry) => entry.tags || []));

  checks.push(
    check(
      "corpus.schema-version",
      "corpus",
      corpus.schemaVersion === 2,
      "The corpus uses the supported schema version.",
    ),
    check(
      "corpus.case-count",
      "corpus",
      corpus.cases.length >= 7,
      "The fixed corpus contains at least seven distinct governance cases.",
      `${corpus.cases.length} cases`,
    ),
    check(
      "corpus.unique-ids",
      "corpus",
      new Set(ids).size === ids.length,
      "Every corpus case has a unique identifier.",
    ),
    check(
      "corpus.mode-coverage",
      "corpus",
      ["idea", "code", "mindmap", "prompt", "brief"].every((mode) => modes.has(mode)),
      "Every public workspace mode is represented.",
      [...modes].sort().join(", "),
    ),
    check(
      "corpus.agent-role-coverage",
      "corpus",
      corpus.hardGates.requiredAgentRoles.every((role) => agentRoles.has(role)) &&
        [...agentRoles].every((role) => corpus.hardGates.requiredAgentRoles.includes(role)),
      "Every allowlisted specialist role is represented by the fixed governance corpus.",
      [...agentRoles].sort().join(", "),
    ),
    check(
      "corpus.challenge-coverage",
      "corpus",
      requiredTags.every((tag) => tags.has(tag)),
      "The corpus covers baseline quality and every mandatory governance challenge.",
      requiredTags.filter((tag) => !tags.has(tag)).join(", ") || "complete",
    ),
    check(
      "corpus.expectations",
      "corpus",
      corpus.cases.every(
        (entry) =>
          entry.expect &&
          Object.values(entry.expect).some((value) =>
            Array.isArray(value) ? value.length > 0 : Boolean(value),
          ),
      ),
      "Every case carries at least one explicit expected outcome.",
    ),
    check(
      "corpus.input-budget",
      "corpus",
      corpus.cases.every(
        (entry) =>
          entry.workspace.length + entry.objective.length <=
          corpus.hardGates.maximumWorkspaceCharacters,
      ),
      "Every fixture stays inside the production workspace character budget.",
    ),
    check(
      "corpus.truthful-evaluation-policy",
      "corpus",
      corpus.evaluationPolicy?.scope ===
        "deterministic-configuration-and-safety-governance-gates" &&
        corpus.evaluationPolicy?.callsModels === false &&
        corpus.evaluationPolicy?.usesProductionData === false &&
        corpus.evaluationPolicy?.autonomousPromotion === false &&
        corpus.evaluationPolicy?.promotion ===
          "versioned-change-human-approval-rollback",
      "The corpus truthfully distinguishes static governance gates from model-quality evaluation and autonomous promotion.",
    ),
  );
}

function validateAgent(corpus, agentSource, routeSource, typesSource, checks) {
  const protocolVersion = extract(
    agentSource,
    /CREATIVE_AGENT_PROTOCOL_VERSION\s*=\s*"([^"]+)"/,
    "creative-agent protocol version",
  );
  const defaultModel = extract(
    agentSource,
    /KINGXFORD_CREATIVE_MODEL\s*\|\|\s*"([^"]+)"/,
    "creative-agent default model",
  );
  const fallbackModels = extract(
    agentSource,
    /KINGXFORD_CREATIVE_FALLBACK_MODELS\s*\|\|\s*"([^"]+)"/,
    "creative-agent fallback models",
  )
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const maxOutputTokens = Number(
    extract(agentSource, /maxOutputTokens:\s*(\d+)/, "maximum output tokens"),
  );
  const maximumRequestBytes = Number(
    extract(routeSource, /MAX_REQUEST_BYTES\s*=\s*(\d+)/, "maximum request bytes"),
  );
  const attemptTimeoutMilliseconds = Number(
    extract(
      routeSource,
      /CREATIVE_AGENT_ATTEMPT_TIMEOUT_MS\s*=\s*(\d+)/,
      "agent attempt timeout",
    ),
  );
  const requestsPerMinute = Number(
    extract(routeSource, /REQUESTS_PER_WINDOW\s*=\s*(\d+)/, "request limit"),
  );

  checks.push(
    check(
      "config.protocol-version",
      "config",
      protocolVersion === corpus.protocolVersion,
      "The implementation protocol matches the fixed evaluation corpus.",
      protocolVersion,
    ),
    check(
      "config.default-model",
      "config",
      defaultModel === corpus.defaultModel && /^[a-z0-9-]+\/[a-z0-9.-]+$/.test(defaultModel),
      "The default model is an explicit Gateway provider/model slug.",
      defaultModel,
    ),
    check(
      "config.current-family-fallback",
      "config",
      fallbackModels.length > 0 &&
        fallbackModels.every((model) => /^openai\/gpt-5\.6-(?:sol|terra|luna)$/.test(model)),
      "Every default fallback remains within the current GPT-5.6 family.",
      fallbackModels.join(", "),
    ),
    check(
      "config.agent-role-contract",
      "schema",
      corpus.hardGates.requiredAgentRoles.every(
        (role) =>
          typesSource.includes(`"${role}"`) &&
          new RegExp(`\\b${role}:`).test(agentSource),
      ) &&
        typesSource.includes("export type WorkspaceAgentRole") &&
        typesSource.includes("agentRole: WorkspaceAgentRole") &&
        routeSource.includes(
          'agentRole: z.enum(workspaceAgentRoles).default("conductor")',
        ),
      "The shared contract and route expose only the seven allowlisted roles and default older clients to Conductor.",
    ),
    check(
      "config.versioned-role-mandates",
      "prompt",
      /CREATIVE_AGENT_ROLE_MANDATE_VERSION\s*=\s*"kx-role-[^"]+"/.test(
        agentSource,
      ) &&
        agentSource.includes("roleMandate(agentRole)") &&
        agentSource.includes("This role changes analytical emphasis only") &&
        agentSource.includes("It grants no tools, external access, execution authority, or side effects"),
      "Every specialist selection applies a versioned, bounded mandate without expanding capability.",
    ),
    check(
      "route.agent-role-binding",
      "route",
      routeSource.includes("requestedAgentRole: value.agentRole") &&
        routeSource.includes("parsed.data.agentRole") &&
        routeSource.includes("agentRole: input.agentRole") &&
        routeSource.includes("agentRole: parsed.data.agentRole"),
      "The selected specialist is bound into the untrusted payload, model mandate, and response provenance.",
    ),
    check(
      "config.structured-output",
      "schema",
      /Output\.object\(\{\s*schema:\s*agentReviewSchema\s*\}\)/s.test(agentSource),
      "The agent is bound to the versioned structured review schema.",
    ),
    check(
      "config.structured-code-output",
      "schema",
      /improvedCode:\s*agentCodeSchema\.nullable\(\)/.test(agentSource) &&
        ["html", "css", "javascript"].every((field) =>
          new RegExp(`\\b${field}\\s*:`).test(agentSource),
        ),
      "Code reviews return explicit HTML, CSS, and JavaScript files while text reviews return null.",
    ),
    check(
      "config.output-budget",
      "config",
      maxOutputTokens === corpus.hardGates.maximumOutputTokens,
      "The configured output budget matches the reviewed structured-artifact budget.",
      String(maxOutputTokens),
    ),
    check(
      "config.reasoning-bounds",
      "config",
      corpus.hardGates.allowedReasoning.every((value) => agentSource.includes(`"${value}"`)) &&
        /reasoningEffort:\s*depth\s*===\s*"deep"\s*\?\s*"max"\s*:\s*"medium"/.test(
          agentSource,
        ) &&
        /reasoningMode:\s*"standard"/.test(agentSource) &&
        !/reasoningMode:\s*"pro"/.test(agentSource),
      "Standard uses medium effort and Deep uses documented max effort without enabling Pro mode.",
    ),
    check(
      "config.no-tools",
      "capability",
      corpus.hardGates.forbiddenAgentProperties.every(
        (property) => !new RegExp(`\\b${property}\\s*:`).test(agentSource),
      ),
      "The public review agent exposes no external tools or side-effect capability.",
    ),
    check(
      "config.openai-provider-options",
      "privacy",
      /providerOptions:\s*\{/.test(agentSource) &&
        corpus.hardGates.requiredOpenAIProviderOptions.every((property) =>
          new RegExp(`\\b${property}\\s*:`).test(agentSource),
        ) &&
        /store:\s*false/.test(agentSource) &&
        /reasoningSummary:\s*null/.test(agentSource) &&
        /reasoningContext:\s*"current_turn"/.test(agentSource),
      "OpenAI requests use explicit effort, retention, reasoning-context, and safety options.",
    ),
    check(
      "config.gateway-provider-options",
      "privacy",
      corpus.hardGates.requiredGatewayProviderOptions.every((property) =>
        new RegExp(`\\b${property}\\s*:`).test(agentSource),
      ) &&
        /disallowPromptTraining:\s*true/.test(agentSource) &&
        agentSource.includes("feature:creative-workspace") &&
        agentSource.includes("protocol:"),
      "Gateway requests opt out of prompt-training routes and carry governed attribution tags.",
    ),
    check(
      "config.explicit-auth-availability",
      "privacy",
      agentSource.includes("process.env.AI_GATEWAY_API_KEY") &&
        agentSource.includes("process.env.VERCEL_OIDC_TOKEN") &&
        !/process\.env\.VERCEL\s*[,|)]/.test(agentSource),
      "Provider availability requires explicit Gateway credentials rather than a generic deployment flag.",
    ),
    check(
      "route.request-rate",
      "route",
      requestsPerMinute <= corpus.hardGates.requestsPerMinute,
      "The anonymous route request limit stays within policy.",
      `${requestsPerMinute} requests/minute per local bucket`,
    ),
    check(
      "route.workspace-budget",
      "route",
      routeSource.includes(`total > ${corpus.hardGates.maximumWorkspaceCharacters}`),
      "The route enforces the governed workspace character ceiling.",
    ),
    check(
      "route.byte-budget",
      "route",
      maximumRequestBytes === corpus.hardGates.maximumRequestBytes &&
        routeSource.includes("value.byteLength") &&
        routeSource.includes("RequestBodyTooLargeError") &&
        routeSource.includes("status: 413"),
      "The route enforces its byte ceiling while streaming the body, including requests without Content-Length.",
      `${maximumRequestBytes} bytes`,
    ),
    check(
      "route.attempt-timeout",
      "route",
      attemptTimeoutMilliseconds === corpus.hardGates.attemptTimeoutMilliseconds &&
        routeSource.includes("AbortSignal.timeout(") &&
        routeSource.includes("AbortSignal.any(["),
      "Every provider attempt has a bounded timeout composed with client cancellation.",
      `${attemptTimeoutMilliseconds} ms`,
    ),
    check(
      "route.bounded-fallback-chain",
      "route",
      routeSource.includes(`.slice(0, ${corpus.hardGates.maximumProviderAttempts})`) &&
        routeSource.includes("canAttemptFallback(failureCode)"),
      "The synchronous route caps provider attempts and stops fallback on non-recoverable failures.",
      `${corpus.hardGates.maximumProviderAttempts} provider attempts maximum`,
    ),
  );

  for (const field of corpus.hardGates.requiredReviewFields) {
    checks.push(
      check(
        `schema.review.${field}`,
        "schema",
        new RegExp(`\\b${field}\\s*:`).test(agentSource),
        `Structured review field '${field}' remains present.`,
      ),
    );
  }

  for (const field of corpus.hardGates.requiredBuildBriefFields) {
    checks.push(
      check(
        `schema.build-brief.${field}`,
        "schema",
        new RegExp(`\\b${field}\\s*:`).test(agentSource),
        `Build brief field '${field}' remains present.`,
      ),
    );
  }

  for (const boundary of corpus.hardGates.requiredPromptBoundaries) {
    checks.push(
      check(
        `prompt.${sha256(boundary).slice(0, 10)}`,
        "prompt",
        agentSource.toLowerCase().includes(boundary.toLowerCase()),
        `Required prompt boundary remains explicit: ${boundary}`,
      ),
    );
  }

  for (const protection of corpus.hardGates.requiredRouteProtections) {
    checks.push(
      check(
        `route.${protection.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        "route",
        routeSource.includes(protection),
        `Required route protection remains present: ${protection}`,
      ),
    );
  }

  checks.push(
    check(
      "route.secret-patterns",
      "route",
      ["sk-", "gh[oprsu]", "PRIVATE KEY", "AKIA"].every((token) =>
        routeSource.includes(token),
      ),
      "The pre-provider credential screen covers the governed token classes.",
    ),
    check(
      "route.truthful-fallback",
      "route",
      routeSource.includes("local structural review, not model-generated feedback") &&
        routeSource.includes("local-readiness-rules-v1"),
      "The no-key fallback is labelled as deterministic local analysis.",
    ),
    check(
      "route.no-store-header",
      "route",
      routeSource.includes('"Cache-Control": "no-store'),
      "Agent responses are explicitly marked no-store.",
    ),
    check(
      "route.strict-production-origin",
      "route",
      routeSource.includes('request.headers.get("origin")') &&
        routeSource.includes('request.headers.get("host")') &&
        routeSource.includes('request.headers.get("sec-fetch-site")') &&
        routeSource.includes('process.env.NODE_ENV === "production"') &&
        routeSource.includes('fetchSite !== "same-origin"') &&
        routeSource.includes("new URL(origin).host === host"),
      "Production requests require matching Origin, Host, and same-origin browser fetch metadata.",
    ),
    check(
      "route.fixed-code-logging",
      "privacy",
      routeSource.includes('console.error("[workspace-agent] agent_attempt_failed", { code, attempt })') &&
        !routeSource.includes("candidate?.message") &&
        !routeSource.includes("causeMessage") &&
        !routeSource.includes("Bearer [redacted]") &&
        !/console\.error\([^\n]*(?:error|model)/.test(routeSource),
      "Provider failures log only a fixed classification code and attempt number, never upstream messages or payloads.",
    ),
    check(
      "route.truthful-daily-policy",
      "governance",
      routeSource.includes(
        'evaluationScope: "deterministic-configuration-and-safety-governance-gates"',
      ) &&
        routeSource.includes("dailyModelQualityEvaluationEnabled: false") &&
        routeSource.includes("no-autonomous-deployment"),
      "The capability response truthfully describes daily static gates and does not imply autonomous model improvement.",
    ),
    check(
      "route.high-entropy-boundary",
      "prompt",
      /randomBytes\(32\)\.toString\("hex"\)/.test(routeSource) &&
        routeSource.includes("KX_UNTRUSTED_DATA_BEGIN_") &&
        routeSource.includes("KX_UNTRUSTED_DATA_END_"),
      "Every request receives a fresh 256-bit untrusted-data boundary.",
    ),
    check(
      "route.canonical-untrusted-payload",
      "prompt",
      routeSource.includes("const payload = JSON.stringify({") &&
        [
          "reviewObjective",
          "requestedReviewDepth",
          "requestedAgentRole",
          "workspace",
          "mode",
          "title",
          "source",
          "selectedContext",
          "previewConsole",
          "priorVersions",
        ].every((field) => routeSource.includes(`${field}:`)) &&
        !routeSource.includes("<WORKSPACE_DATA>"),
      "The objective and selected workspace fields share one canonical untrusted JSON envelope.",
    ),
    check(
      "route.input-digest",
      "route",
      /inputDigest:\s*createHash\("sha256"\)\.update\(payload\)\.digest\("hex"\)/.test(routeSource) &&
        routeSource.includes("inputDigest: serialized.inputDigest"),
      "Responses bind reviews to the exact canonical payload digest.",
    ),
    check(
      "route.mode-bound-code-output",
      "schema",
      routeSource.includes('parsed.data.mode === "code" && !result.output.improvedCode') &&
        routeSource.includes('parsed.data.mode !== "code" && result.output.improvedCode !== null'),
      "The route rejects structured output whose code payload does not match the reviewed mode.",
    ),
  );

  return {
    protocolVersion,
    defaultModel,
    fallbackModels,
    maxOutputTokens,
    maximumRequestBytes,
    attemptTimeoutMilliseconds,
    requestsPerMinute,
  };
}

function validateLocalAnalysis(localAnalysisSource, checks) {
  checks.push(
    check(
      "local.code-aware-transform",
      "local-analysis",
      localAnalysisSource.includes("function codeConcept(") &&
        localAnalysisSource.includes("parseDraftConcept(draft)") &&
        localAnalysisSource.includes("visibleCodeLines(draft.code)"),
      "Local transformations derive textual concepts from the current code source.",
    ),
    check(
      "local.complete-code-fallback",
      "local-analysis",
      localAnalysisSource.includes("improvedCode:") &&
        localAnalysisSource.includes('draft.mode === "code" ? { ...draft.code } : null'),
      "The deterministic fallback preserves all three code files as one typed proposal.",
    ),
    check(
      "local.deterministic-change-summary",
      "local-analysis",
      localAnalysisSource.includes("export function summarizeDraftChanges(") &&
        ["Text:", "HTML:", "CSS:", "JavaScript:"].every((label) =>
          localAnalysisSource.includes(label),
        ),
      "A deterministic helper summarizes source changes across text and every code file.",
    ),
  );
}

function validateWorkflow(workflowSource, checks) {
  const forbiddenWritePaths = [
    /\bcontents:\s*write\b/,
    /\bpull-requests:\s*write\b/,
    /\bissues:\s*write\b/,
    /\bgit\s+push\b/,
    /\bgh\s+pr\b/,
    /create-pull-request/i,
    /merge-pull-request/i,
  ];

  checks.push(
    check(
      "workflow.read-only-permissions",
      "workflow",
      /permissions:\s*\n\s+contents:\s*read\b/.test(workflowSource) &&
        forbiddenWritePaths.every((pattern) => !pattern.test(workflowSource)),
      "The governance workflow has read-only repository permissions and no write command path.",
    ),
    check(
      "workflow.no-persisted-credentials",
      "workflow",
      /persist-credentials:\s*false\b/.test(workflowSource),
      "Checkout credentials are not persisted in the evaluation runner.",
    ),
    check(
      "workflow.schedule-and-manual",
      "workflow",
      /schedule:/.test(workflowSource) && /workflow_dispatch:/.test(workflowSource),
      "Governance verification supports a daily schedule and explicit manual runs.",
    ),
    check(
      "workflow.pull-request-gate",
      "workflow",
      /pull_request:\s*\n\s+paths:/.test(workflowSource) &&
        [
          "src/lib/workspace/agent.ts",
          "src/lib/workspace/types.ts",
          "src/app/api/workspace/agent/route.ts",
          "evals/creative-agent/**",
          "scripts/verify-creative-agent.mjs",
        ].every((path) => workflowSource.includes(path)),
      "The deterministic gate runs on pull requests that change the governed agent surface.",
    ),
    check(
      "workflow.truthful-static-scope",
      "workflow",
      workflowSource.includes("Creative agent deterministic governance") &&
        workflowSource.includes("Verify deterministic configuration and safety gates") &&
        workflowSource.includes("Run deterministic governance verification"),
      "Workflow labels accurately describe deterministic governance rather than live model-quality evaluation.",
    ),
    check(
      "workflow.report-artifact",
      "workflow",
      /actions\/upload-artifact@v4/.test(workflowSource) && /if:\s*always\(\)/.test(workflowSource),
      "The report is uploaded even when a hard gate fails.",
    ),
    check(
      "workflow.no-secrets",
      "workflow",
      !/\$\{\{\s*secrets\./.test(workflowSource),
      "The deterministic workflow does not request or interpolate repository secrets.",
    ),
  );
}

async function verifyCatalog(model, checks) {
  if (!isEnabled(process.env.VERIFY_GATEWAY_MODEL_CATALOG)) {
    checks.push({
      id: "catalog.optional-check",
      group: "catalog",
      status: "skip",
      detail: "Public Gateway model catalog verification was not requested.",
    });
    return { status: "skipped", endpoint: CATALOG_URL };
  }

  try {
    const response = await fetch(CATALOG_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`catalog returned HTTP ${response.status}`);
    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];
    const present = models.some((entry) => entry?.id === model);
    checks.push(
      check(
        "catalog.configured-model",
        "catalog",
        present,
        "The configured model appears in the public Gateway catalog.",
        `${models.length} catalog entries inspected`,
      ),
    );
    return {
      status: present ? "passed" : "failed",
      endpoint: CATALOG_URL,
      modelFound: present,
      modelCount: models.length,
    };
  } catch (error) {
    checks.push(
      warning(
        "catalog.unavailable",
        `The optional public catalog check was unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      ),
    );
    return { status: "unavailable", endpoint: CATALOG_URL };
  }
}

function markdownSummary(report) {
  const failed = report.checks.filter((entry) => entry.status === "fail");
  const warnings = report.checks.filter((entry) => entry.status === "warning");
  return `# Creative agent governance report

- Outcome: **${report.outcome.toUpperCase()}**
- Protocol: \`${report.protocolVersion}\`
- Model: \`${report.defaultModel}\`
- Corpus: \`${report.corpusVersion}\`
- Checks: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings, ${report.summary.skipped} skipped
- Generated: ${report.generatedAt}

${failed.length ? `## Failed hard gates\n\n${failed.map((entry) => `- **${entry.id}** — ${entry.detail}`).join("\n")}` : "All deterministic hard gates passed."}

${warnings.length ? `## Warnings\n\n${warnings.map((entry) => `- **${entry.id}** — ${entry.detail}`).join("\n")}` : ""}
`;
}

async function main() {
  const [
    agentSource,
    routeSource,
    typesSource,
    localAnalysisSource,
    corpusText,
    workflowSource,
  ] = await Promise.all([
    readFile(path.join(ROOT, AGENT_PATH), "utf8"),
    readFile(path.join(ROOT, ROUTE_PATH), "utf8"),
    readFile(path.join(ROOT, TYPES_PATH), "utf8"),
    readFile(path.join(ROOT, LOCAL_ANALYSIS_PATH), "utf8"),
    readFile(path.join(ROOT, CORPUS_PATH), "utf8"),
    readFile(path.join(ROOT, WORKFLOW_PATH), "utf8"),
  ]);
  const corpus = JSON.parse(corpusText);
  const checks = [];

  validateCorpus(corpus, checks);
  const config = validateAgent(
    corpus,
    agentSource,
    routeSource,
    typesSource,
    checks,
  );
  validateLocalAnalysis(localAnalysisSource, checks);
  validateWorkflow(workflowSource, checks);
  const catalog = await verifyCatalog(config.defaultModel, checks);

  const summary = {
    passed: checks.filter((entry) => entry.status === "pass").length,
    failed: checks.filter((entry) => entry.status === "fail").length,
    warnings: checks.filter((entry) => entry.status === "warning").length,
    skipped: checks.filter((entry) => entry.status === "skip").length,
  };
  const report = {
    reportSchemaVersion: 2,
    generatedAt: new Date().toISOString(),
    outcome: summary.failed === 0 ? "pass" : "fail",
    commit: process.env.GITHUB_SHA || null,
    protocolVersion: config.protocolVersion,
    corpusVersion: corpus.corpusVersion,
    defaultModel: config.defaultModel,
    configuration: {
      fallbackModels: config.fallbackModels,
      maxOutputTokens: config.maxOutputTokens,
      maximumRequestBytes: config.maximumRequestBytes,
      attemptTimeoutMilliseconds: config.attemptTimeoutMilliseconds,
      maximumProviderAttempts: corpus.hardGates.maximumProviderAttempts,
      requestsPerMinute: config.requestsPerMinute,
      evaluationScope: corpus.evaluationPolicy.scope,
    },
    sourceHashes: {
      agent: sha256(agentSource),
      route: sha256(routeSource),
      types: sha256(typesSource),
      localAnalysis: sha256(localAnalysisSource),
      corpus: sha256(corpusText),
      workflow: sha256(workflowSource),
    },
    catalog,
    summary,
    checks,
  };

  const directory = reportDirectory();
  await mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, "report.json");
  const markdownPath = path.join(directory, "summary.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, markdownSummary(report), "utf8"),
  ]);

  console.log(
    `Creative agent governance: ${report.outcome.toUpperCase()} (${summary.passed} passed, ${summary.failed} failed, ${summary.warnings} warnings, ${summary.skipped} skipped)`,
  );
  console.log(`Report: ${jsonPath}`);
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  const directory = reportDirectory();
  await mkdir(directory, { recursive: true });
  const fatalReport = {
    reportSchemaVersion: 2,
    generatedAt: new Date().toISOString(),
    outcome: "fail",
    commit: process.env.GITHUB_SHA || null,
    summary: { passed: 0, failed: 1, warnings: 0, skipped: 0 },
    checks: [
      {
        id: "verifier.fatal",
        group: "verifier",
        status: "fail",
        detail: `The deterministic verifier could not complete: ${message}`,
      },
    ],
  };
  await Promise.all([
    writeFile(
      path.join(directory, "report.json"),
      `${JSON.stringify(fatalReport, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(directory, "summary.md"),
      `# Creative agent governance report\n\n- Outcome: **FAIL**\n- Fatal verifier error: ${message}\n`,
      "utf8",
    ),
  ]);
  console.error(`Creative agent governance verifier could not complete: ${message}`);
  process.exitCode = 1;
});
