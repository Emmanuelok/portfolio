import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { brotliDecompress } from "node:zlib";

import chromiumBinary from "@sparticuz/chromium";
import { chromium } from "playwright-core";

const BASE_URL = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const REPORT_DIR = path.resolve(
  process.env.PLATFORM_JOURNEY_REPORT_DIR ?? "verification/platform-journey",
);
const REPORT_PATH = path.join(REPORT_DIR, "platform-journey.json");
const PROJECT_SEED_KEY = "kingxford:project-seed:v1";
const SEED_AUDIT_KEY = "__kingxford_platform_journey_seed_writes__";
const IDEA =
  "Build a neighbourhood heat evidence exchange for libraries and residents.";
const WORK_ROUTE = "/work/veridanth";
const MEDIA_ROUTE = "/media/sustainable-abundance-for-all";
const WORKSPACE_ROUTE = "/create/workspace";
const PHASES = [
  ["discovery", "Discovery"],
  ["evidence", "Evidence"],
  ["systems", "Systems"],
  ["prototype", "Prototype"],
  ["validation", "Validation"],
  ["delivery", "Delivery"],
];
const BEFORE_CODE = {
  html: '<main data-journey="before"><h1>Neighbourhood evidence exchange</h1></main>',
  css: ':root { --journey-stage: "before"; } body { margin: 0; }',
  javascript: 'globalThis.__kingxfordJourneyStage = "before";',
};

await fs.mkdir(REPORT_DIR, { recursive: true });

const results = [];
const failures = [];
const runtime = {
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  httpErrors: [],
};

function serializableError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  return { name: "Error", message: String(error) };
}

function check(id, condition, evidence = {}) {
  const record = {
    ...evidence,
    id,
    status: condition ? "pass" : "fail",
  };
  results.push(record);
  if (!condition) failures.push(record);
  return condition;
}

function demand(id, condition, evidence = {}) {
  if (check(id, condition, evidence)) return;
  throw new Error(`Required journey checkpoint failed: ${id}`);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isSuperset(values, expected) {
  const actual = new Set(values);
  return expected.every((value) => actual.has(value));
}

async function poll(label, read, accept = Boolean, timeoutMs = 12_000) {
  const startedAt = Date.now();
  let lastValue;
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastValue = await read();
      if (accept(lastValue)) return lastValue;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const suffix = lastError
    ? ` Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    : ` Last value: ${JSON.stringify(lastValue)?.slice(0, 500)}`;
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

async function executablePathAndArgs() {
  // Sparticuz's font archive carries ownership metadata that some container
  // filesystems reject. Inflating only Chromium mirrors the established visual
  // verifier and keeps the browser build identical in local and CI runs.
  const localChromiumPath = path.join(os.tmpdir(), "chromium");
  try {
    await fs.access(localChromiumPath);
  } catch {
    const decompress = promisify(brotliDecompress);
    const compressed = await fs.readFile(
      path.resolve("node_modules/@sparticuz/chromium/bin/chromium.br"),
    );
    const binary = await decompress(compressed);
    await fs.writeFile(localChromiumPath, binary, { mode: 0o700 });
  }

  chromiumBinary.setGraphicsMode = false;
  const executablePath = await chromiumBinary.executablePath();
  const unsupportedArgs = new Set([
    // This route enforces same-origin writes. Keeping Chromium's web security
    // enabled is essential because disabling it suppresses the Origin header.
    "--disable-web-security",
    "--in-process-gpu",
    "--single-process",
    "--use-angle=swiftshader",
    "--use-gl=angle",
    "--enable-unsafe-swiftshader",
  ]);
  const args = chromiumBinary.args.filter(
    (argument) => !unsupportedArgs.has(argument),
  );
  args.push(
    "--disable-background-networking",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
  );
  return { executablePath, args };
}

async function readSeedWrites(page) {
  return page.evaluate((key) => {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }, SEED_AUDIT_KEY);
}

async function readStoredProject(page) {
  return page.evaluate(() => {
    const seen = new Set();
    const findProject = (value, valuePath, depth = 0) => {
      if (
        !value ||
        typeof value !== "object" ||
        seen.has(value) ||
        depth > 9
      ) {
        return null;
      }
      seen.add(value);
      if (
        value.schema === "kingxford-project-repository" &&
        Array.isArray(value.projects)
      ) {
        const active = value.projects.find(
          (project) => project?.id === value.activeProjectId,
        );
        if (active?.schema === "kingxford-project") {
          return {
            path: `${valuePath}.projects[activeProjectId=${value.activeProjectId}]`,
            project: active,
          };
        }
      }
      if (value.schema === "kingxford-project") {
        return { path: valuePath, project: value };
      }
      for (const [key, child] of Object.entries(value)) {
        const found = findProject(child, `${valuePath}.${key}`, depth + 1);
        if (found) return found;
      }
      return null;
    };

    for (const [storageName, storage] of [
      ["localStorage", window.localStorage],
      ["sessionStorage", window.sessionStorage],
    ]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key) continue;
        try {
          const parsed = JSON.parse(storage.getItem(key) ?? "null");
          const found = findProject(parsed, `${storageName}.${key}`);
          if (found) return found;
        } catch {
          // Non-JSON browser preferences are unrelated to the project record.
        }
      }
    }
    return null;
  });
}

async function settledProject(page, accept, label) {
  return poll(
    label,
    () => readStoredProject(page),
    (value) => Boolean(value && accept(value.project)),
  );
}

async function waitForNetworkIdle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
}

async function visit(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "domcontentloaded",
  });
  demand(
    `route${route.replaceAll("/", ".") || ".home"}`,
    Boolean(response?.ok()),
    { route, httpStatus: response?.status() ?? null },
  );
  await page.locator("main").waitFor({ state: "visible" });
  await waitForNetworkIdle(page);
}

async function enterCanvas(page, action) {
  const navigation = page.waitForURL((url) => url.pathname === WORKSPACE_ROUTE, {
    timeout: 15_000,
  });
  await action.click();
  await navigation;
  await page.locator("#workspace-title").waitFor({ state: "visible" });
  await waitForNetworkIdle(page);
}

async function atlasSelection(page) {
  return page
    .locator('section[aria-labelledby="project-atlas-title"]')
    .evaluate((atlas) => {
      const tabs = [...atlas.querySelectorAll('[role="tab"]')];
      const selected = tabs.filter(
        (tab) => tab.getAttribute("aria-selected") === "true",
      );
      const zeroTabStops = tabs.filter(
        (tab) => tab.getAttribute("tabindex") === "0",
      );
      return {
        selectedIds: selected.map((tab) => tab.id),
        zeroTabStopIds: zeroTabStops.map((tab) => tab.id),
        activeId:
          document.activeElement instanceof HTMLElement
            ? document.activeElement.id
            : "",
      };
    });
}

async function assertAtlasSelection(page, phase) {
  const expected = `atlas-tab-${phase}`;
  const state = await poll(
    `${phase} Atlas selection`,
    () => atlasSelection(page),
    (value) =>
      value.selectedIds.length === 1 &&
      value.selectedIds[0] === expected &&
      value.zeroTabStopIds.length === 1 &&
      value.zeroTabStopIds[0] === expected &&
      value.activeId === expected,
  );
  return state;
}

async function inspectAtlasLayout(page) {
  return page
    .locator('section[aria-labelledby="project-atlas-title"]')
    .evaluate((atlas) => {
      const tabs = [...atlas.querySelectorAll('[role="tab"]')];
      const rect = atlas.getBoundingClientRect();
      const describe = (element) => {
        if (!(element instanceof Element)) return null;
        const id = element.id ? `#${element.id}` : "";
        const classes = [...element.classList]
          .slice(0, 3)
          .map((value) => `.${value}`)
          .join("");
        const role = element.getAttribute("role");
        const label = element.getAttribute("aria-label");
        return `${element.tagName.toLocaleLowerCase()}${id}${classes}${role ? `[role=${role}]` : ""}${label ? `[aria-label=${label}]` : ""}`;
      };
      const overflowCandidates = [...document.body.querySelectorAll("*")]
        .flatMap((element) => {
          const elementRect = element.getBoundingClientRect();
          if (elementRect.right <= window.innerWidth + 1 && elementRect.left >= -1) {
            return [];
          }
          let ancestor = element.parentElement;
          let clippingAncestor = null;
          while (ancestor && ancestor !== document.body) {
            const style = getComputedStyle(ancestor);
            if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {
              clippingAncestor = ancestor;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          const style = getComputedStyle(element);
          return [{
            selector: describe(element),
            left: elementRect.left,
            right: elementRect.right,
            width: elementRect.width,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            position: style.position,
            overflowX: style.overflowX,
            minWidth: style.minWidth,
            maxWidth: style.maxWidth,
            clippingAncestor: describe(clippingAncestor),
          }];
        })
        .sort((left, right) => {
          const clippingDelta = Number(Boolean(left.clippingAncestor))
            - Number(Boolean(right.clippingAncestor));
          return clippingDelta || right.right - left.right;
        })
        .slice(0, 20);
      return {
        atlasVisible:
          rect.width > 0 &&
          rect.height > 0 &&
          getComputedStyle(atlas).visibility !== "hidden",
        atlasLeft: rect.left,
        atlasRight: rect.right,
        viewportWidth: window.innerWidth,
        pageHorizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
        documentWidth: {
          htmlClient: document.documentElement.clientWidth,
          htmlScroll: document.documentElement.scrollWidth,
          bodyClient: document.body.clientWidth,
          bodyScroll: document.body.scrollWidth,
        },
        overflowCandidates,
        tabs: tabs.map((tab) => {
          const tabRect = tab.getBoundingClientRect();
          return {
            id: tab.id,
            text: tab.textContent?.replace(/\s+/g, " ").trim() ?? "",
            width: tabRect.width,
            height: tabRect.height,
            left: tabRect.left,
            right: tabRect.right,
            display: getComputedStyle(tab).display,
            visibility: getComputedStyle(tab).visibility,
          };
        }),
      };
    });
}

async function verifyAtlasDesktop(page) {
  const atlas = page.locator('section[aria-labelledby="project-atlas-title"]');
  await atlas.waitFor({ state: "visible" });
  await atlas.scrollIntoViewIfNeeded();
  const layout = await inspectAtlasLayout(page);
  const expectedIds = PHASES.map(([id]) => `atlas-tab-${id}`);
  const actualIds = layout.tabs.map(({ id }) => id);
  const actualLabels = layout.tabs.map(({ text }) =>
    PHASES.find(([, label]) => text.includes(label))?.[1] ?? "",
  );
  check(
    "atlas.desktop.six-phases",
    layout.atlasVisible &&
      JSON.stringify(actualIds) === JSON.stringify(expectedIds) &&
      JSON.stringify(actualLabels) === JSON.stringify(PHASES.map(([, label]) => label)) &&
      layout.tabs.every(
        ({ width, height, left, right, display, visibility }) =>
          width > 0 &&
          height > 0 &&
          left >= -1 &&
          right <= layout.viewportWidth + 1 &&
          display !== "none" &&
          visibility !== "hidden",
      ) &&
      !layout.pageHorizontalOverflow,
    { layout },
  );

  const discovery = page.locator("#atlas-tab-discovery");
  await discovery.click();
  await discovery.focus();
  await assertAtlasSelection(page, "discovery");
  await page.keyboard.press("ArrowRight");
  await assertAtlasSelection(page, "evidence");
  await page.keyboard.press("End");
  await assertAtlasSelection(page, "delivery");
  await page.keyboard.press("Home");
  await assertAtlasSelection(page, "discovery");
  await page.keyboard.press("ArrowLeft");
  const wrapped = await assertAtlasSelection(page, "delivery");
  check("atlas.desktop.roving-tabs", true, { wrapped });
  await page.keyboard.press("Home");
  await assertAtlasSelection(page, "discovery");

  await atlas.screenshot({ path: path.join(REPORT_DIR, "atlas-desktop.png") });
}

async function verifyAtlasMobile(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const atlas = page.locator('section[aria-labelledby="project-atlas-title"]');
  await atlas.scrollIntoViewIfNeeded();
  const layout = await inspectAtlasLayout(page);
  check(
    "atlas.mobile.six-phases",
    layout.atlasVisible &&
      layout.tabs.length === PHASES.length &&
      layout.tabs.every(
        ({ width, height, display, visibility }) =>
          width > 0 &&
          height > 0 &&
          display !== "none" &&
          visibility !== "hidden",
      ) &&
      layout.atlasLeft >= -1 &&
      layout.atlasRight <= layout.viewportWidth + 1 &&
      !layout.pageHorizontalOverflow,
    { layout },
  );

  const discovery = page.locator("#atlas-tab-discovery");
  await discovery.click();
  await discovery.focus();
  await page.keyboard.press("ArrowRight");
  const selection = await assertAtlasSelection(page, "evidence");
  check("atlas.mobile.roving-tabs", true, { selection });
  await atlas.screenshot({ path: path.join(REPORT_DIR, "atlas-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function setCodeFile(page, file, value) {
  await page.locator(`#workspace-code-tab-${file}`).click();
  const editor = page.locator("#workspace-code-editor");
  await editor.fill(value);
  await poll(
    `${file} editor update`,
    () => editor.inputValue(),
    (actual) => actual === value,
  );
}

async function readCodeFiles(page) {
  const values = {};
  for (const file of ["html", "css", "javascript"]) {
    await page.locator(`#workspace-code-tab-${file}`).click();
    values[file] = await page.locator("#workspace-code-editor").inputValue();
  }
  return values;
}

function snapshotWithinBounds(snapshot, bounds) {
  if (!isRecord(snapshot) || !isRecord(bounds)) return false;
  const arrayBounds = [
    ["nodes", bounds.nodes],
    ["edges", bounds.edges],
    ["artifacts", bounds.artifacts],
    ["gates", bounds.gates],
    ["decisions", bounds.decisions],
    ["reviewLinks", bounds.reviewLinks],
  ];
  return (
    snapshot.schema === "kingxford-project-snapshot" &&
    Number.isInteger(snapshot.characterCount) &&
    snapshot.characterCount >= 0 &&
    snapshot.characterCount <= bounds.characters &&
    arrayBounds.every(
      ([key, maximum]) =>
        Array.isArray(snapshot[key]) && snapshot[key].length <= maximum,
    )
  );
}

let browser;
let context;
let page;
let runtimeRecorded = false;

function recordRuntimeChecks() {
  if (runtimeRecorded) return;
  runtimeRecorded = true;
  check("runtime.console-errors", runtime.consoleErrors.length === 0, {
    errors: runtime.consoleErrors,
  });
  check("runtime.page-errors", runtime.pageErrors.length === 0, {
    errors: runtime.pageErrors,
  });
  check("runtime.request-failures", runtime.requestFailures.length === 0, {
    errors: runtime.requestFailures,
  });
  check("runtime.http-errors", runtime.httpErrors.length === 0, {
    errors: runtime.httpErrors,
  });
}

try {
  const launch = await executablePathAndArgs();
  browser = await chromium.launch({ ...launch, headless: true });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });

  await context.addInitScript(
    ({ seedKey, auditKey }) => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (this === window.sessionStorage && key === seedKey) {
          try {
            const current = window.localStorage.getItem(auditKey);
            const writes = current ? JSON.parse(current) : [];
            writes.push({ pathname: window.location.pathname, value });
            originalSetItem.call(
              window.localStorage,
              auditKey,
              JSON.stringify(writes),
            );
          } catch {
            // The product write must proceed even if test-only auditing fails.
          }
        }
        return originalSetItem.call(this, key, value);
      };
    },
    { seedKey: PROJECT_SEED_KEY, auditKey: SEED_AUDIT_KEY },
  );

  page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    runtime.consoleErrors.push({
      url: page.url(),
      text: message.text(),
      location: message.location(),
    });
  });
  page.on("pageerror", (error) => {
    runtime.pageErrors.push({ url: page.url(), ...serializableError(error) });
  });
  page.on("requestfailed", (request) => {
    runtime.requestFailures.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
      errorText: request.failure()?.errorText ?? "Unknown request failure",
    });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    runtime.httpErrors.push({
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      status: response.status(),
      url: response.url(),
    });
  });

  await visit(page, "/");
  const ideaInput = page.locator("#idea-router-input");
  await ideaInput.scrollIntoViewIfNeeded();
  await ideaInput.fill(IDEA);
  const ideaAction = page.getByRole("button", {
    name: /Carry this idea into Canvas/i,
  });
  await ideaAction.waitFor({ state: "visible" });
  await enterCanvas(page, ideaAction);

  const seedWritesAfterIdea = await readSeedWrites(page);
  const ideaSeed = isRecord(seedWritesAfterIdea[0])
    ? JSON.parse(seedWritesAfterIdea[0].value)
    : null;
  check(
    "seed.idea-router.write",
    seedWritesAfterIdea.length === 1 &&
      ideaSeed?.version === 1 &&
      ideaSeed?.action === "start-project" &&
      ideaSeed?.source?.kind === "idea-router" &&
      ideaSeed?.source?.href === "/" &&
      ideaSeed?.payload?.title === IDEA &&
      ideaSeed?.payload?.brief === IDEA,
    {
      writeCount: seedWritesAfterIdea.length,
      seed: ideaSeed
        ? {
            version: ideaSeed.version,
            action: ideaSeed.action,
            source: ideaSeed.source,
            title: ideaSeed.payload?.title,
          }
        : null,
    },
  );

  await poll(
    "Canvas title import",
    () => page.locator("#workspace-title").inputValue(),
    (value) => value === IDEA,
  );
  await page.locator("#workspace-mode-idea").click();
  const importedText = await poll(
    "Canvas idea import",
    () => page.locator("#workspace-text-editor").inputValue(),
    (value) => value.includes(IDEA),
  );
  const initialStored = await settledProject(
    page,
    (project) =>
      project.title === IDEA &&
      asArray(project.artifacts).some((artifact) => artifact.kind === "idea") &&
      asArray(project.revisions).some(
        (revision) => revision.body?.type === "text" && revision.body.text.includes(IDEA),
      ),
    "the imported project graph",
  );
  const initialProject = initialStored.project;
  check(
    "seed.idea-router.canvas-import",
    importedText.includes(IDEA) &&
      initialProject.title === IDEA &&
      initialProject.gates?.length === PHASES.length,
    {
      storagePath: initialStored.path,
      projectId: initialProject.id,
      title: initialProject.title,
      artifactCount: initialProject.artifacts?.length ?? 0,
      revisionCount: initialProject.revisions?.length ?? 0,
      gateCount: initialProject.gates?.length ?? 0,
    },
  );

  await verifyAtlasDesktop(page);

  await visit(page, WORK_ROUTE);
  const workAction = page.getByRole("button", {
    name: /Carry this case into Canvas/i,
  });
  await workAction.scrollIntoViewIfNeeded();
  await enterCanvas(page, workAction);
  const workStored = await settledProject(
    page,
    (project) =>
      project.id === initialProject.id &&
      asArray(project.artifacts).filter((artifact) => artifact.kind === "evidence")
        .length >
        asArray(initialProject.artifacts).filter((artifact) => artifact.kind === "evidence")
          .length &&
      JSON.stringify(project).includes("Veridanth"),
    "the Work evidence append",
  );
  const workProject = workStored.project;
  const seedWritesAfterWork = await readSeedWrites(page);
  const workSeed = isRecord(seedWritesAfterWork[1])
    ? JSON.parse(seedWritesAfterWork[1].value)
    : null;
  const initialArtifactIds = asArray(initialProject.artifacts).map(({ id }) => id);
  const initialRevisionIds = asArray(initialProject.revisions).map(({ id }) => id);
  check(
    "evidence.work.append",
    seedWritesAfterWork.length === 2 &&
      workSeed?.action === "add-evidence" &&
      workSeed?.source?.kind === "work" &&
      workSeed?.source?.href === WORK_ROUTE &&
      isSuperset(
        asArray(workProject.artifacts).map(({ id }) => id),
        initialArtifactIds,
      ) &&
      isSuperset(
        asArray(workProject.revisions).map(({ id }) => id),
        initialRevisionIds,
      ),
    {
      projectId: workProject.id,
      evidenceCount: asArray(workProject.artifacts).filter(
        (artifact) => artifact.kind === "evidence",
      ).length,
      artifactCount: workProject.artifacts?.length ?? 0,
      revisionCount: workProject.revisions?.length ?? 0,
      source: workSeed?.source ?? null,
    },
  );
  check(
    "evidence.work.preserves-primary-source",
    (await page.locator("#workspace-title").inputValue()) === IDEA &&
      (await page.locator("#workspace-text-editor").inputValue()).includes(IDEA),
  );

  await visit(page, MEDIA_ROUTE);
  const mediaAction = page.getByRole("button", {
    name: /Carry this note into Canvas/i,
  });
  await mediaAction.scrollIntoViewIfNeeded();
  await enterCanvas(page, mediaAction);
  const mediaStored = await settledProject(
    page,
    (project) => {
      const evidenceArtifact = asArray(project.artifacts).find(
        (artifact) => artifact.kind === "evidence",
      );
      const evidenceRevision = asArray(project.revisions).find(
        (revision) => revision.id === evidenceArtifact?.activeRevisionId,
      );
      const evidenceText = evidenceRevision?.body?.type === "text"
        ? evidenceRevision.body.text
        : "";
      return (
        project.id === initialProject.id &&
        asArray(project.revisions).length > asArray(workProject.revisions).length &&
        evidenceText.includes("Veridanth") &&
        evidenceText.includes("Sustainable Abundance")
      );
    },
    "the Media evidence append",
  );
  const mediaProject = mediaStored.project;
  const seedWritesAfterMedia = await readSeedWrites(page);
  const mediaSeed = isRecord(seedWritesAfterMedia[2])
    ? JSON.parse(seedWritesAfterMedia[2].value)
    : null;
  const workArtifactIds = asArray(workProject.artifacts).map(({ id }) => id);
  const workRevisionIds = asArray(workProject.revisions).map(({ id }) => id);
  const mediaEvidenceArtifact = asArray(mediaProject.artifacts).find(
    (artifact) => artifact.kind === "evidence",
  );
  const mediaEvidenceRevision = asArray(mediaProject.revisions).find(
    (revision) => revision.id === mediaEvidenceArtifact?.activeRevisionId,
  );
  const mediaEvidenceText = mediaEvidenceRevision?.body?.type === "text"
    ? mediaEvidenceRevision.body.text
    : "";
  check(
    "evidence.media.append-retains-work",
    seedWritesAfterMedia.length === 3 &&
      mediaSeed?.action === "add-evidence" &&
      mediaSeed?.source?.kind === "media" &&
      mediaSeed?.source?.href === MEDIA_ROUTE &&
      isSuperset(
        asArray(mediaProject.artifacts).map(({ id }) => id),
        workArtifactIds,
      ) &&
      isSuperset(
        asArray(mediaProject.revisions).map(({ id }) => id),
        workRevisionIds,
      ) &&
      mediaEvidenceText.includes("Veridanth") &&
      mediaEvidenceText.includes("Sustainable Abundance"),
    {
      projectId: mediaProject.id,
      evidenceCount: asArray(mediaProject.artifacts).filter(
        (artifact) => artifact.kind === "evidence",
      ).length,
      artifactCount: mediaProject.artifacts?.length ?? 0,
      revisionCount: mediaProject.revisions?.length ?? 0,
      source: mediaSeed?.source ?? null,
    },
  );

  const lineageText = await page
    .locator('section[aria-labelledby="project-atlas-title"]')
    .textContent();
  check(
    "evidence.atlas-lineage",
    /Lineage/i.test(lineageText ?? "") &&
      asArray(mediaProject.artifacts).length >= 2 &&
      mediaEvidenceText.includes("Veridanth") &&
      mediaEvidenceText.includes("Sustainable Abundance"),
    {
      lineageRendered: /Lineage/i.test(lineageText ?? ""),
      evidenceRevisionId: mediaEvidenceRevision?.id ?? null,
      retainsWork: mediaEvidenceText.includes("Veridanth"),
      retainsMedia: mediaEvidenceText.includes("Sustainable Abundance"),
    },
  );
  await verifyAtlasMobile(page);

  const capabilityResponse = await context.request.get(
    `${BASE_URL}/api/workspace/agent`,
  );
  const capabilityText = await capabilityResponse.text();
  let capability = null;
  try {
    capability = JSON.parse(capabilityText);
  } catch {
    // The demand below reports the status and response excerpt clearly.
  }
  demand(
    "agent.local-fallback-configured",
    capabilityResponse.ok() && capability?.gateway === false,
    {
      httpStatus: capabilityResponse.status(),
      gateway: capability?.gateway ?? null,
      projectContext: capability?.projectContext ?? null,
      responseExcerpt: capability ? undefined : capabilityText.slice(0, 500),
    },
  );

  await page.locator("#workspace-mode-code").click();
  await page.locator("#workspace-code-editor").waitFor({ state: "visible" });
  await setCodeFile(page, "html", BEFORE_CODE.html);
  await setCodeFile(page, "css", BEFORE_CODE.css);
  await setCodeFile(page, "javascript", BEFORE_CODE.javascript);
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(800);

  const preReviewStored = await settledProject(
    page,
    (project) =>
      asArray(project.revisions).some(
        (revision) =>
          revision.body?.type === "code" &&
          revision.body.html === BEFORE_CODE.html &&
          revision.body.css === BEFORE_CODE.css &&
          revision.body.javascript === BEFORE_CODE.javascript,
      ),
    "the exact pre-review code revision",
  );
  const preReviewProject = preReviewStored.project;

  // Keep the request on the page's native fetch path so Chromium supplies its
  // protected Origin and Sec-Fetch-Site headers. The wrapper observes the real
  // local response, then returns a marked structured proposal to prove that all
  // three proposedCode files are accepted by the UI and persisted as a version.
  await page.evaluate(({ beforeCode }) => {
    const captureKey = "__kingxfordPlatformJourneyAgentCapture__";
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(
        typeof input === "string" ? input : request?.url ?? String(input),
        window.location.href,
      );
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      if (url.pathname !== "/api/workspace/agent" || method !== "POST") {
        return nativeFetch(input, init);
      }

      const rawBody = typeof init?.body === "string" ? init.body : "";
      let body = null;
      try {
        body = JSON.parse(rawBody);
      } catch {
        // The server response and request excerpt below diagnose malformed data.
      }

      try {
        const response = await nativeFetch(input, init);
        const upstreamText = await response.clone().text();
        let upstreamBody = null;
        try {
          upstreamBody = JSON.parse(upstreamText);
        } catch {
          // Preserve the excerpt in the capture for a deterministic diagnostic.
        }

        const actualProposal = upstreamBody?.review?.proposedCode;
        const proposedCode = {
          html: `${actualProposal?.html ?? beforeCode.html}\n<section data-journey-proposal="html">Applied HTML proposal</section>`,
          css: `${actualProposal?.css ?? beforeCode.css}\n:root { --journey-stage: "applied-css"; }`,
          javascript: `${actualProposal?.javascript ?? beforeCode.javascript}\nglobalThis.__kingxfordJourneyApplied = "applied-javascript";`,
        };
        const deliveredBody = {
          ...upstreamBody,
          review: {
            ...upstreamBody?.review,
            improvedInput: proposedCode.html,
            proposedCode,
          },
        };
        window[captureKey] = {
          rawBody,
          body,
          upstream: {
            status: response.status,
            body: upstreamBody,
            responseExcerpt: upstreamBody ? null : upstreamText.slice(0, 500),
          },
          deliveredBody,
          error: null,
        };

        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(JSON.stringify(deliveredBody), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        window[captureKey] = {
          rawBody,
          body,
          upstream: null,
          deliveredBody: null,
          error: {
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          },
        };
        throw error;
      }
    };
  }, { beforeCode: BEFORE_CODE });

  await page.locator("#workspace-result-tab-agent").click();
  const graphCheckbox = page.getByLabel("Bounded project graph");
  if (!(await graphCheckbox.isChecked())) await graphCheckbox.check();
  const knowledgeCheckbox = page.getByLabel("Kingxford playbook");
  if (await knowledgeCheckbox.isChecked()) await knowledgeCheckbox.uncheck();
  await page
    .locator("#agent-instruction")
    .fill("Return one bounded, revision-specific proposal for this code artifact.");
  const nativeResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/workspace/agent",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Review this version" }).click();
  const nativeResponse = await nativeResponsePromise;
  const requestHeaders = await nativeResponse.request().allHeaders();
  const agentCapture = await poll(
    "the local fallback response",
    () =>
      page.evaluate(
        () => window.__kingxfordPlatformJourneyAgentCapture__ ?? null,
      ),
    Boolean,
    30_000,
  );
  const interceptedRequest = {
    rawBody: agentCapture.rawBody ?? "",
    body: agentCapture.body ?? null,
    headers: {
      origin: requestHeaders.origin ?? null,
      host: requestHeaders.host ?? null,
      secFetchSite: requestHeaders["sec-fetch-site"] ?? null,
    },
  };
  const upstreamResponse = agentCapture.upstream;
  const deliveredResponse = agentCapture.deliveredBody;
  const routeError = agentCapture.error;
  demand(
    "agent.request.route",
    routeError === null &&
      nativeResponse.status() === 200 &&
      upstreamResponse?.status === 200,
    {
      routeError,
      httpStatus: upstreamResponse?.status ?? nativeResponse.status(),
      requestHeaders: interceptedRequest.headers,
      responseExcerpt: upstreamResponse?.responseExcerpt ?? null,
    },
  );
  await page.getByText("Local structural review", { exact: true }).waitFor({
    state: "visible",
    timeout: 15_000,
  });

  const requestBody = interceptedRequest?.body;
  const snapshot = requestBody?.projectGraphSnapshot;
  const bounds = capability?.projectContext?.bounds;
  const revisionId = requestBody?.artifactRevisionId;
  const selectedArtifact = asArray(snapshot?.artifacts).find(
    (artifact) => artifact.activeRevision?.id === revisionId,
  );
  const upstream = upstreamResponse?.body;
  check(
    "agent.request.bounded-snapshot",
    Buffer.byteLength(interceptedRequest?.rawBody ?? "", "utf8") < 90_000 &&
      snapshotWithinBounds(snapshot, bounds),
    {
      requestBytes: Buffer.byteLength(interceptedRequest?.rawBody ?? "", "utf8"),
      snapshotId: snapshot?.id ?? null,
      snapshotCharacterCount: snapshot?.characterCount ?? null,
      counts: isRecord(snapshot)
        ? {
            nodes: asArray(snapshot.nodes).length,
            edges: asArray(snapshot.edges).length,
            artifacts: asArray(snapshot.artifacts).length,
            gates: asArray(snapshot.gates).length,
            decisions: asArray(snapshot.decisions).length,
            reviewLinks: asArray(snapshot.reviewLinks).length,
          }
        : null,
      bounds: bounds ?? null,
    },
  );
  check(
    "agent.request.exact-revision",
    typeof revisionId === "string" &&
      selectedArtifact?.activeRevision?.truncated === false &&
      selectedArtifact?.activeRevision?.body?.type === "code" &&
      selectedArtifact.activeRevision.body.html === BEFORE_CODE.html &&
      selectedArtifact.activeRevision.body.css === BEFORE_CODE.css &&
      selectedArtifact.activeRevision.body.javascript === BEFORE_CODE.javascript &&
      upstream?.projectContext?.artifactRevisionId === revisionId &&
      upstream?.projectContext?.draftHash ===
        selectedArtifact?.activeRevision?.contentHash,
    {
      revisionId: revisionId ?? null,
      artifactId: selectedArtifact?.id ?? null,
      revisionHash: selectedArtifact?.activeRevision?.contentHash ?? null,
      responseProjectContext: upstream?.projectContext ?? null,
    },
  );
  check(
    "agent.response.local-structured-code",
    upstream?.source === "local" &&
      upstream?.review?.proposedCode?.html === BEFORE_CODE.html &&
      upstream?.review?.proposedCode?.css === BEFORE_CODE.css &&
      upstream?.review?.proposedCode?.javascript === BEFORE_CODE.javascript &&
      upstream?.review?.improvedInput === upstream?.review?.proposedCode?.html,
    {
      source: upstream?.source ?? null,
      model: upstream?.model ?? null,
      hasStructuredProposal: Boolean(upstream?.review?.proposedCode),
    },
  );

  await page.getByRole("button", { name: "Apply as a new version" }).click();
  const appliedCode = await poll(
    "all structured proposal files to apply",
    () => readCodeFiles(page),
    (value) =>
      value.html === deliveredResponse.review.proposedCode.html &&
      value.css === deliveredResponse.review.proposedCode.css &&
      value.javascript === deliveredResponse.review.proposedCode.javascript,
  );
  check("agent.response.applies-all-code-files", true, {
    htmlMarker: appliedCode.html.includes('data-journey-proposal="html"'),
    cssMarker: appliedCode.css.includes('"applied-css"'),
    javascriptMarker: appliedCode.javascript.includes('"applied-javascript"'),
  });

  const appliedStored = await settledProject(
    page,
    (project) =>
      asArray(project.revisions).some(
        (revision) =>
          revision.source === "agent-accepted" &&
          revision.body?.type === "code" &&
          revision.body.html === deliveredResponse.review.proposedCode.html &&
          revision.body.css === deliveredResponse.review.proposedCode.css &&
          revision.body.javascript ===
            deliveredResponse.review.proposedCode.javascript,
      ),
    "the applied Agent proposal revision",
  );
  check(
    "agent.response.records-proposal-revision",
    appliedStored.project.id === preReviewProject.id &&
      asArray(appliedStored.project.revisions).length >
        asArray(preReviewProject.revisions).length,
    {
      projectId: appliedStored.project.id,
      beforeRevisionCount: preReviewProject.revisions?.length ?? 0,
      afterRevisionCount: appliedStored.project.revisions?.length ?? 0,
    },
  );

  await page.waitForTimeout(400);
  recordRuntimeChecks();
  check("journey.complete", failures.length === 0, {
    checkpoints: results.length,
  });
} catch (error) {
  check("journey.complete", false, { error: serializableError(error) });
  recordRuntimeChecks();
  if (page) {
    try {
      await page.screenshot({
        path: path.join(REPORT_DIR, "failure.png"),
        fullPage: false,
      });
    } catch {
      // The JSON report remains the primary diagnostic if the page is gone.
    }
  }
} finally {
  await browser?.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  passed: failures.length === 0,
  reportDirectory: REPORT_DIR,
  failures,
  results,
  runtime,
};

await fs.writeFile(REPORT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
