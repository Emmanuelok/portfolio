import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const AGENT_PATH = "src/lib/workspace/agent.ts";
const ROUTE_PATH = "src/app/api/workspace/agent/route.ts";
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
  const ids = corpus.cases.map((entry) => entry.id);
  const tags = new Set(corpus.cases.flatMap((entry) => entry.tags || []));

  checks.push(
    check(
      "corpus.schema-version",
      "corpus",
      corpus.schemaVersion === 1,
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
  );
}

function validateAgent(corpus, agentSource, routeSource, checks) {
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
  const maxOutputTokens = Number(
    extract(agentSource, /maxOutputTokens:\s*(\d+)/, "maximum output tokens"),
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
      "config.structured-output",
      "schema",
      /Output\.object\(\{\s*schema:\s*agentReviewSchema\s*\}\)/s.test(agentSource),
      "The agent is bound to the versioned structured review schema.",
    ),
    check(
      "config.output-budget",
      "config",
      maxOutputTokens <= corpus.hardGates.maximumOutputTokens,
      "The configured output budget does not exceed the governance ceiling.",
      String(maxOutputTokens),
    ),
    check(
      "config.reasoning-bounds",
      "config",
      corpus.hardGates.allowedReasoning.every((value) => agentSource.includes(`"${value}"`)) &&
        !/reasoning:\s*"(?:max|pro)"/.test(agentSource),
      "Reasoning settings remain within the reviewed standard/deep bounds.",
    ),
    check(
      "config.no-tools",
      "capability",
      corpus.hardGates.forbiddenAgentProperties.every(
        (property) => !new RegExp(`\\b${property}\\s*:`).test(agentSource),
      ),
      "The public agent exposes no external tools or provider-side capability expansion.",
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
  );

  return { protocolVersion, defaultModel, maxOutputTokens, requestsPerMinute };
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
      "The scheduled workflow has read-only repository permissions and no write command path.",
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
  const [agentSource, routeSource, corpusText, workflowSource] = await Promise.all([
    readFile(path.join(ROOT, AGENT_PATH), "utf8"),
    readFile(path.join(ROOT, ROUTE_PATH), "utf8"),
    readFile(path.join(ROOT, CORPUS_PATH), "utf8"),
    readFile(path.join(ROOT, WORKFLOW_PATH), "utf8"),
  ]);
  const corpus = JSON.parse(corpusText);
  const checks = [];

  validateCorpus(corpus, checks);
  const config = validateAgent(corpus, agentSource, routeSource, checks);
  validateWorkflow(workflowSource, checks);
  const catalog = await verifyCatalog(config.defaultModel, checks);

  const summary = {
    passed: checks.filter((entry) => entry.status === "pass").length,
    failed: checks.filter((entry) => entry.status === "fail").length,
    warnings: checks.filter((entry) => entry.status === "warning").length,
    skipped: checks.filter((entry) => entry.status === "skip").length,
  };
  const report = {
    reportSchemaVersion: 1,
    generatedAt: new Date().toISOString(),
    outcome: summary.failed === 0 ? "pass" : "fail",
    commit: process.env.GITHUB_SHA || null,
    protocolVersion: config.protocolVersion,
    corpusVersion: corpus.corpusVersion,
    defaultModel: config.defaultModel,
    configuration: {
      maxOutputTokens: config.maxOutputTokens,
      requestsPerMinute: config.requestsPerMinute,
    },
    sourceHashes: {
      agent: sha256(agentSource),
      route: sha256(routeSource),
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
    reportSchemaVersion: 1,
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
