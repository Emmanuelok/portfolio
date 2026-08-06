import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { brotliDecompress } from "node:zlib";

import chromiumBinary from "@sparticuz/chromium";
import { chromium } from "playwright-core";

const BASE_URL = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const READINESS_ONLY = process.env.VERIFY_READINESS_ONLY === "1";
const EXPECTED_READINESS_STATE =
  process.env.VERIFY_EXPECTED_READINESS_STATE ??
  (READINESS_ONLY ? "deployment-blocked" : "local-fallback");
const AI_READINESS_CONTRACT_VERSION = "kx-ai-readiness-2026-08-06.1";
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
const CREATE_ROUTE = "/create";
const WORKSPACE_ROUTE = "/create/workspace";
const SHARED_NAVIGATION = [
  ["Mission", "/"],
  ["Work", "/work"],
  ["Lab", "/lab"],
  ["Field notes", "/media"],
  ["Create", CREATE_ROUTE],
];
const CREATE_DIRECTIONS = [
  ["Websites and digital destinations", "#capability-websites"],
  ["Digital tools", "#capability-digital-tools"],
  ["Institutional systems", "#capability-institutional-systems"],
  ["Research and AI tools", "#capability-research-ai-tools"],
  ["Operational tools", "#capability-operational-tools"],
  ["Education tools", "#capability-education-tools"],
  ["Everyday personal tools", "#capability-personal-tools"],
];
const CREATE_MENU_DIRECTIONS = [
  ["Websites", "/create#capability-websites"],
  ["Digital tools", "/create#capability-digital-tools"],
  ["Institutional systems", "/create#capability-institutional-systems"],
  ["Research + AI", "/create#capability-research-ai-tools"],
  ["Operations", "/create#capability-operational-tools"],
  ["Education", "/create#capability-education-tools"],
  ["Everyday tools", "/create#capability-personal-tools"],
];
const CREATE_SECTION_ANCHORS = [
  ["Live proofs", "#websites"],
  ["Seven directions", "#capabilities"],
  ["Canvas + Atlas", "#studio"],
  ["Full catalogue", "#catalogue"],
  ["Focus mode", WORKSPACE_ROUTE],
];
const CREATE_PROOFS = [
  ["Science", "/create/lumen-vale-laboratory"],
  ["Finance", "/create/meridian-financial-office"],
  ["Education", "/create/commonfield-institute"],
];
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

function hasExactKeys(value, expected) {
  return (
    isRecord(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
  );
}

function validReadinessRoute(route, expectedReasoning) {
  if (
    !hasExactKeys(route, [
      "primary",
      "fallbacks",
      "reasoning",
      "maxOutputTokens",
    ])
  ) {
    return false;
  }
  const modelPattern =
    /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._:-]{0,127}$/i;
  const fallbacks = asArray(route.fallbacks);
  return (
    typeof route.primary === "string" &&
    modelPattern.test(route.primary) &&
    fallbacks.length <= 2 &&
    fallbacks.every(
      (model) =>
        typeof model === "string" &&
        modelPattern.test(model) &&
        model !== route.primary,
    ) &&
    new Set(fallbacks).size === fallbacks.length &&
    route.reasoning === expectedReasoning &&
    Number.isInteger(route.maxOutputTokens) &&
    route.maxOutputTokens > 0
  );
}

function readinessStateIsExact(payload, expectedState) {
  const readiness = payload?.readiness;
  if (
    !hasExactKeys(readiness, [
      "contractVersion",
      "codeReady",
      "deploymentReady",
      "providerReady",
      "usageProtectionReady",
      "localFallbackReady",
      "status",
      "blockers",
      "provider",
      "usageProtection",
      "routes",
      "governance",
    ]) ||
    !hasExactKeys(readiness.provider, [
      "authMethod",
      "configurationVerified",
      "liveConnectionVerified",
      "modelCatalogVerifiedAtRequest",
    ]) ||
    !hasExactKeys(readiness.usageProtection, [
      "source",
      "requiredInProduction",
      "minimumSecretCharacters",
    ]) ||
    !hasExactKeys(readiness.routes, ["standard", "deep"]) ||
    !hasExactKeys(readiness.governance, [
      "toolsEnabled",
      "automaticApplyEnabled",
      "gateApprovalMode",
    ])
  ) {
    return false;
  }

  const expected =
    expectedState === "local-fallback"
      ? {
          usageProtectionReady: true,
          localFallbackReady: true,
          status: "local-fallback",
          blockers: ["gateway-auth-missing"],
          usageSource: "configured-secret",
          mode: "local-fallback",
        }
      : expectedState === "deployment-blocked"
        ? {
            usageProtectionReady: false,
            localFallbackReady: false,
            status: "deployment-blocked",
            blockers: [
              "gateway-auth-missing",
              "usage-protection-missing",
            ],
            usageSource: "missing",
            mode: "unavailable",
          }
        : null;
  if (!expected) return false;

  const blockers = asArray(readiness.blockers);
  return (
    readiness.contractVersion === AI_READINESS_CONTRACT_VERSION &&
    readiness.codeReady === true &&
    readiness.deploymentReady === false &&
    readiness.providerReady === false &&
    readiness.usageProtectionReady === expected.usageProtectionReady &&
    readiness.localFallbackReady === expected.localFallbackReady &&
    readiness.status === expected.status &&
    JSON.stringify(blockers.map(({ code }) => code)) ===
      JSON.stringify(expected.blockers) &&
    blockers.every(
      (blocker) =>
        hasExactKeys(blocker, ["code", "message"]) &&
        typeof blocker.message === "string" &&
        blocker.message.length > 0 &&
        blocker.message.length <= 240,
    ) &&
    readiness.provider.authMethod === "none" &&
    readiness.provider.configurationVerified === false &&
    readiness.provider.liveConnectionVerified === false &&
    readiness.provider.modelCatalogVerifiedAtRequest === false &&
    readiness.usageProtection.source === expected.usageSource &&
    readiness.usageProtection.requiredInProduction === true &&
    readiness.usageProtection.minimumSecretCharacters === 32 &&
    validReadinessRoute(readiness.routes.standard, "medium") &&
    validReadinessRoute(readiness.routes.deep, "xhigh") &&
    readiness.governance.toolsEnabled === false &&
    readiness.governance.automaticApplyEnabled === false &&
    readiness.governance.gateApprovalMode === "human-only" &&
    payload.available === readiness.deploymentReady &&
    payload.gateway === readiness.providerReady &&
    payload.usageProtectionConfigured === readiness.usageProtectionReady &&
    payload.mode === expected.mode
  );
}

async function verifyLiveAiReadiness(page, expectedState) {
  const endpoints = ["/api/workspace/agent", "/api/intelligence/runs"];
  const diagnostics = await page.evaluate(async (routes) => {
    const output = [];
    for (const route of routes) {
      const response = await fetch(route, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const text = await response.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {
        // The bounded excerpt below makes a non-JSON regression explicit.
      }
      output.push({
        route,
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get("content-type"),
        body,
        responseExcerpt: body ? null : text.slice(0, 500),
      });
    }
    return output;
  }, endpoints);

  for (const diagnostic of diagnostics) {
    const id = diagnostic.route.endsWith("workspace/agent")
      ? "workspace-agent"
      : "intelligence-runs";
    demand(
      `readiness.${id}.${expectedState}`,
      diagnostic.ok &&
        diagnostic.status === 200 &&
        diagnostic.contentType?.startsWith("application/json") &&
        readinessStateIsExact(diagnostic.body, expectedState),
      {
        route: diagnostic.route,
        httpStatus: diagnostic.status,
        contentType: diagnostic.contentType,
        readiness: diagnostic.body?.readiness ?? null,
        legacy: diagnostic.body
          ? {
              available: diagnostic.body.available,
              gateway: diagnostic.body.gateway,
              usageProtectionConfigured:
                diagnostic.body.usageProtectionConfigured,
              mode: diagnostic.body.mode,
            }
          : null,
        responseExcerpt: diagnostic.responseExcerpt,
      },
    );
  }

  const [workspace, intelligence] = diagnostics.map(({ body }) => body);
  demand(
    `readiness.cross-api-coherent.${expectedState}`,
    JSON.stringify(workspace?.readiness) ===
      JSON.stringify(intelligence?.readiness),
    {
      workspaceReadiness: workspace?.readiness ?? null,
      intelligenceReadiness: intelligence?.readiness ?? null,
    },
  );
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

async function verifySharedNavigation(page, surface) {
  const links = await page
    .locator('nav[aria-label="Primary navigation"] a.site-header__nav-link')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => ({
        label: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
        href: new URL(anchor.getAttribute("href") ?? "", window.location.href)
          .pathname,
        visible:
          anchor instanceof HTMLElement &&
          anchor.getBoundingClientRect().width > 0 &&
          anchor.getBoundingClientRect().height > 0 &&
          getComputedStyle(anchor).visibility !== "hidden",
      })),
    );
  check(
    `navigation.${surface}.five-shared-destinations`,
    JSON.stringify(links.map(({ label, href }) => [label, href])) ===
      JSON.stringify(SHARED_NAVIGATION) &&
      links.every(({ visible }) => visible),
    { links },
  );
}

async function inspectCreateSurface(page) {
  return page.evaluate(
    ({ directions, sectionAnchors }) => {
      const visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      };
      const box = (element) => {
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          visible: visible(element),
        };
      };
      const describe = (element) => {
        if (!(element instanceof Element)) return null;
        const id = element.id ? `#${element.id}` : "";
        const classes = [...element.classList]
          .slice(0, 4)
          .map((value) => `.${value}`)
          .join("");
        const role = element.getAttribute("role");
        const label = element.getAttribute("aria-label");
        const dataSurface = [
          "data-create-capability-menu",
          "data-create-capability",
          "data-create-studio",
          "data-prototype-gallery",
          "data-embedded",
        ].find((attribute) => element.hasAttribute(attribute));
        return `${element.tagName.toLowerCase()}${id}${classes}${role ? `[role=${role}]` : ""}${label ? `[aria-label=${label}]` : ""}${dataSurface ? `[${dataSurface}=${element.getAttribute(dataSurface) ?? ""}]` : ""}`;
      };
      const links = (selector) =>
        [...document.querySelectorAll(selector)].map((anchor) => ({
          label: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
          href: anchor.getAttribute("href"),
          visible: visible(anchor),
        }));
      const embedded = document.querySelector(
        '#studio [data-embedded="true"]',
      );
      const embeddedButtons = embedded
        ? [...embedded.querySelectorAll("button")]
        : [];
      const internalAnchors = links('main a[href^="#"]').map((anchor) => {
        const target = anchor.href
          ? document.getElementById(anchor.href.slice(1))
          : null;
        return {
          ...anchor,
          targetExists: Boolean(target),
          targetVisible: visible(target),
        };
      });
      const keySurfaces = Object.fromEntries(
        [
          ["hero", 'section[aria-labelledby="create-heading"]'],
          ["gallery", "#websites"],
          ["directions", "#capabilities"],
          ["studio", "#studio"],
          ["catalogue", "#catalogue"],
        ].map(([name, selector]) => [name, box(document.querySelector(selector))]),
      );
      const categoryLinks = links(
        'nav[aria-label="Creation categories"] a',
      );
      const directionLinks = [
        ...document.querySelectorAll(
          '[data-create-capability-menu] nav[aria-label="Seven creation directions"] a',
        ),
      ].map((anchor) => ({
        label:
          anchor.querySelector("strong")?.textContent?.replace(/\s+/g, " ").trim() ??
          "",
        href: anchor.getAttribute("href"),
        visible: visible(anchor),
      }));
      const routerLinks = links(
        'nav[aria-label="Kingxford Intelligence sections"] a',
      ).map((item) => ({
        ...item,
        normalizedLabel: item.label.replace(/^(?:\d{2}|↗)\s*/, ""),
      }));
      const viewportWidth = document.documentElement.clientWidth;
      const overflowCandidates = [...document.body.querySelectorAll("*")]
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          const escapesViewport =
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.right > viewportWidth + 1 || rect.left < -1);
          const ownsOverflow = element.scrollWidth > element.clientWidth + 1;
          if (!escapesViewport && !ownsOverflow) return [];

          let ancestor = element.parentElement;
          let clippingAncestor = null;
          while (ancestor && ancestor !== document.body) {
            const ancestorStyle = getComputedStyle(ancestor);
            if (/^(auto|scroll|hidden|clip)$/.test(ancestorStyle.overflowX)) {
              clippingAncestor = ancestor;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          const style = getComputedStyle(element);
          return [{
            selector: describe(element),
            parent: describe(element.parentElement),
            left: rect.left,
            right: rect.right,
            width: rect.width,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            escapesViewport,
            ownsOverflow,
            position: style.position,
            display: style.display,
            overflowX: style.overflowX,
            minWidth: style.minWidth,
            maxWidth: style.maxWidth,
            whiteSpace: style.whiteSpace,
            clippingAncestor: describe(clippingAncestor),
          }];
        })
        .sort((left, right) => {
          const escapedDelta = Number(right.escapesViewport) - Number(left.escapesViewport);
          if (escapedDelta) return escapedDelta;
          const clippingDelta = Number(Boolean(left.clippingAncestor)) -
            Number(Boolean(right.clippingAncestor));
          if (clippingDelta) return clippingDelta;
          return (right.right - viewportWidth) - (left.right - viewportWidth);
        })
        .slice(0, 40);
      return {
        expectedDirections: directions,
        expectedSectionAnchors: sectionAnchors,
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        documentOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
        documentWidths: {
          htmlClient: document.documentElement.clientWidth,
          htmlScroll: document.documentElement.scrollWidth,
          bodyClient: document.body.clientWidth,
          bodyScroll: document.body.scrollWidth,
        },
        overflowCandidates,
        heroHeading:
          document.querySelector("#create-heading")?.textContent?.trim() ?? "",
        categoryLinks,
        directionLinks,
        routerLinks,
        internalAnchors,
        keySurfaces,
        gallery: {
          visible: visible(document.querySelector("#websites")),
          prototypeVisible: visible(
            document.querySelector('[data-prototype-gallery="true"]'),
          ),
          tabs: links(
            '[data-prototype-gallery="true"] [role="tab"]',
          ),
        },
        catalogue: {
          visible: visible(document.querySelector("#catalogue")),
          articles: [
            ...document.querySelectorAll("#catalogue article[id]"),
          ].map((article) => ({
            id: article.id,
            capability: article.getAttribute("data-create-capability"),
            visible: visible(article),
          })),
        },
        embeddedCanvas: {
          visible: visible(embedded),
          canvasHeading:
            embedded?.querySelector("#canvas-title")?.textContent?.trim() ?? "",
          libraryVisible: embeddedButtons.some(
            (button) =>
              button.textContent?.replace(/\s+/g, " ").trim() === "Library" &&
              visible(button),
          ),
          conductorVisible: embeddedButtons.some(
            (button) =>
              button.textContent?.replace(/\s+/g, " ").trim() === "Conductor" &&
              visible(button),
          ),
        },
      };
    },
    {
      directions: CREATE_DIRECTIONS,
      sectionAnchors: CREATE_SECTION_ANCHORS,
    },
  );
}

async function verifyCreateSurface(page, viewport) {
  const state = await inspectCreateSurface(page);
  const expectedDirectionIds = CREATE_DIRECTIONS.map(([, href]) => href.slice(1));
  const actualCategoryLinks = state.categoryLinks.map(({ label, href }) => [
    label.replace(/^\d{2}\s*/, ""),
    href,
  ]);
  const actualDirectionLinks = state.directionLinks.map(({ label, href }) => [
    label.replace(/^\d{2}\s*/, ""),
    href,
  ]);
  const actualRouterLinks = state.routerLinks.map(
    ({ normalizedLabel, href }) => [normalizedLabel, href],
  );

  check(
    `create.${viewport}.hero-and-seven-direction-menu`,
    state.heroHeading === "What should exist next?" &&
      JSON.stringify(actualCategoryLinks) === JSON.stringify(CREATE_DIRECTIONS) &&
      JSON.stringify(actualDirectionLinks) === JSON.stringify(CREATE_DIRECTIONS) &&
      state.categoryLinks.every(({ visible }) => visible) &&
      state.directionLinks.every(({ visible }) => visible),
    {
      heroHeading: state.heroHeading,
      categoryLinks: state.categoryLinks,
      directionLinks: state.directionLinks,
    },
  );
  check(
    `create.${viewport}.gallery-and-full-catalogue`,
    state.gallery.visible &&
      state.gallery.prototypeVisible &&
      state.gallery.tabs.length === 3 &&
      state.gallery.tabs.every(({ visible }) => visible) &&
      state.catalogue.visible &&
      JSON.stringify(
        state.catalogue.articles.map(({ id, capability }) => [id, capability]),
      ) ===
        JSON.stringify(
          expectedDirectionIds.map((id) => [id, id.replace(/^capability-/, "")]),
        ) &&
      state.catalogue.articles.every(({ visible }) => visible),
    {
      gallery: state.gallery,
      catalogue: state.catalogue,
    },
  );
  check(
    `create.${viewport}.embedded-canvas-library-conductor`,
    state.embeddedCanvas.visible &&
      state.embeddedCanvas.canvasHeading ===
        "Move from first thought to working proof." &&
      state.embeddedCanvas.libraryVisible &&
      state.embeddedCanvas.conductorVisible,
    { embeddedCanvas: state.embeddedCanvas },
  );
  check(
    `create.${viewport}.anchors-and-no-document-overflow`,
    JSON.stringify(actualRouterLinks) ===
      JSON.stringify(CREATE_SECTION_ANCHORS) &&
      state.routerLinks.every(({ visible }) => visible) &&
      state.internalAnchors.length >= 12 &&
      state.internalAnchors.every(
        ({ visible, targetExists, targetVisible }) =>
          visible && targetExists && targetVisible,
      ) &&
      !state.documentOverflow &&
      Object.values(state.keySurfaces).every(
        (surface) =>
          surface &&
          surface.visible &&
          surface.left >= -1 &&
          surface.right <= state.viewportWidth + 1,
      ),
    {
      routerLinks: state.routerLinks,
      internalAnchors: state.internalAnchors,
      viewportWidth: state.viewportWidth,
      documentWidth: state.documentWidth,
      documentWidths: state.documentWidths,
      overflowCandidates: state.overflowCandidates,
      keySurfaces: state.keySurfaces,
    },
  );
}

async function waitForCreateMobileStyles(page) {
  // Chromium can briefly expose the new viewport dimensions before the loaded
  // stylesheet has recomputed its media-query cascade. Wait on product styles,
  // not elapsed time, so overflow is measured only after the 390px layout is
  // the layout a native mobile navigation would receive.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  return poll(
    "the Create mobile media-query cascade",
    () =>
      page.evaluate(() => {
        const categoryRail = document.querySelector(
          'nav[aria-label="Creation categories"]',
        );
        const buildButton = [
          ...document.querySelectorAll('[data-embedded="true"] button'),
        ].find(
          (button) =>
            button.textContent?.replace(/\s+/g, " ").trim() ===
            "Build with Kingxford",
        );
        const categoryColumns = categoryRail
          ? getComputedStyle(categoryRail).gridTemplateColumns
              .split(/\s+/)
              .filter(Boolean)
          : [];
        return {
          viewportWidth: document.documentElement.clientWidth,
          mobileMediaMatches: matchMedia("(max-width: 820px)").matches,
          categoryColumnCount: categoryColumns.length,
          buildButtonMinWidth:
            buildButton instanceof HTMLElement
              ? getComputedStyle(buildButton).minWidth
              : null,
        };
      }),
    (state) =>
      state.viewportWidth === 390 &&
      state.mobileMediaMatches &&
      state.categoryColumnCount === 2 &&
      state.buildButtonMinWidth === "0px",
  );
}

async function verifyCreatePageDirectionClicks(page, viewport) {
  const clicked = [];
  for (const [label, href] of CREATE_DIRECTIONS) {
    const anchor = page.locator(
      `[data-create-capability-menu] nav[aria-label="Seven creation directions"] a[href="${href}"]`,
    );
    await anchor.scrollIntoViewIfNeeded();
    await anchor.click();
    const state = await poll(
      `${viewport} Create direction ${href}`,
      () =>
        page.evaluate((targetHref) => {
          const target = document.getElementById(targetHref.slice(1));
          const rect = target?.getBoundingClientRect();
          return {
            hash: window.location.hash,
            targetExists: Boolean(target),
            targetVisible: Boolean(
              target &&
                rect &&
                rect.width > 0 &&
                rect.height > 0 &&
                getComputedStyle(target).visibility !== "hidden",
            ),
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
          };
        }, href),
      (value) =>
        value.hash === href &&
        value.targetExists &&
        value.targetVisible &&
        value.documentWidth <= value.viewportWidth + 1,
    );
    clicked.push({ label, href, ...state });
  }
  check(
    `create.${viewport}.seven-canonical-direction-clicks`,
    clicked.length === CREATE_DIRECTIONS.length &&
      clicked.every(
        ({ href, hash, targetExists, targetVisible, documentWidth, viewportWidth }) =>
          hash === href &&
          targetExists &&
          targetVisible &&
          documentWidth <= viewportWidth + 1,
      ),
    { clicked },
  );
}

async function resetCreateRoute(page) {
  const response = await page.goto(`${BASE_URL}${CREATE_ROUTE}`, {
    waitUntil: "domcontentloaded",
  });
  if (!response?.ok()) {
    throw new Error(
      `Could not restore ${CREATE_ROUTE}; HTTP ${response?.status() ?? "unknown"}.`,
    );
  }
  await page.locator("#create-heading").waitFor({ state: "visible" });
  await waitForNetworkIdle(page);
}

async function openCreateHeaderMenu(page, viewport) {
  if (viewport === "desktop") {
    const panel = page.locator("#site-header-create-panel");
    if (!(await panel.isVisible())) {
      await page
        .locator('button[aria-controls="site-header-create-panel"]')
        .click();
    }
    await panel.waitFor({ state: "visible" });
    return;
  }

  const mobileMenu = page.locator("details.site-header__mobile-menu");
  const mobileMenuOpen = await mobileMenu.evaluate(
    (element) => element instanceof HTMLDetailsElement && element.open,
  );
  if (!mobileMenuOpen) {
    await mobileMenu.locator('summary[aria-label="Navigation menu"]').click();
  }

  const createMenu = mobileMenu.locator("details.site-header__mobile-create");
  const createMenuOpen = await createMenu.evaluate(
    (element) => element instanceof HTMLDetailsElement && element.open,
  );
  if (!createMenuOpen) await createMenu.locator("summary").click();
  await createMenu
    .locator(".site-header__mobile-create-catalogue")
    .waitFor({ state: "visible" });
}

async function inspectCreateHeaderMenu(page, viewport) {
  const selectors =
    viewport === "desktop"
      ? {
          directions: "#site-header-create-panel .site-header__create-catalogue a",
          proofs: "#site-header-create-panel .site-header__create-proofs a",
        }
      : {
          directions: ".site-header__mobile-create-catalogue a",
          proofs: ".site-header__mobile-create-proofs a",
        };
  return page.evaluate((menuSelectors) => {
    const read = (selector) =>
      [...document.querySelectorAll(selector)].map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        const style = getComputedStyle(anchor);
        return {
          label: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
          href: anchor.getAttribute("href"),
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden",
        };
      });
    return {
      directions: read(menuSelectors.directions),
      proofs: read(menuSelectors.proofs),
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    };
  }, selectors);
}

async function clickCreateHeaderDestination(page, viewport, href) {
  await openCreateHeaderMenu(page, viewport);
  const scope =
    viewport === "desktop"
      ? href.includes("#capability-")
        ? "#site-header-create-panel .site-header__create-catalogue"
        : "#site-header-create-panel .site-header__create-proofs"
      : href.includes("#capability-")
        ? ".site-header__mobile-create-catalogue"
        : ".site-header__mobile-create-proofs";
  const anchor = page.locator(`${scope} a[href="${href}"]`);
  await anchor.scrollIntoViewIfNeeded();
  await anchor.click();
  const expected = new URL(href, BASE_URL);
  return poll(
    `${viewport} Create menu destination ${href}`,
    () =>
      page.evaluate(() => ({
        pathname: window.location.pathname,
        hash: window.location.hash,
        headingVisible: Boolean(
          document.querySelector("main h1")?.getBoundingClientRect().height,
        ),
        targetVisible: window.location.hash
          ? Boolean(
              document
                .getElementById(window.location.hash.slice(1))
                ?.getBoundingClientRect().height,
            )
          : true,
      })),
    (value) =>
      value.pathname === expected.pathname &&
      value.hash === expected.hash &&
      value.headingVisible &&
      value.targetVisible,
  );
}

async function verifyCreateHeaderMenuDestinations(page, viewport) {
  await openCreateHeaderMenu(page, viewport);
  const initial = await inspectCreateHeaderMenu(page, viewport);
  const expectedDirectionHrefs = CREATE_MENU_DIRECTIONS.map(([, href]) => href);
  const expectedProofHrefs = CREATE_PROOFS.map(([, href]) => href);
  const menuShapeIsExact =
    JSON.stringify(initial.directions.map(({ href }) => href)) ===
      JSON.stringify(expectedDirectionHrefs) &&
    JSON.stringify(initial.proofs.map(({ href }) => href)) ===
      JSON.stringify(expectedProofHrefs) &&
    initial.directions.every(({ visible }) => visible) &&
    initial.proofs.every(({ visible }) => visible) &&
    initial.documentWidth <= initial.viewportWidth + 1;

  const clickedDirections = [];
  for (const [label, href] of CREATE_MENU_DIRECTIONS) {
    const destination = await clickCreateHeaderDestination(
      page,
      viewport,
      href,
    );
    clickedDirections.push({ label, href, ...destination });
  }

  const clickedProofs = [];
  for (const [label, href] of CREATE_PROOFS) {
    const destination = await clickCreateHeaderDestination(
      page,
      viewport,
      href,
    );
    clickedProofs.push({ label, href, ...destination });
    await resetCreateRoute(page);
  }

  check(
    `create.${viewport}.header-seven-directions-and-three-proofs`,
    menuShapeIsExact &&
      clickedDirections.length === CREATE_MENU_DIRECTIONS.length &&
      clickedProofs.length === CREATE_PROOFS.length &&
      [...clickedDirections, ...clickedProofs].every(
        ({ href, pathname, hash, headingVisible, targetVisible }) => {
          const expected = new URL(href, BASE_URL);
          return (
            pathname === expected.pathname &&
            hash === expected.hash &&
            headingVisible &&
            targetVisible
          );
        },
      ),
    { initial, clickedDirections, clickedProofs },
  );
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

function observeRuntime(observedPage) {
  observedPage.on("console", (message) => {
    if (message.type() !== "error") return;
    runtime.consoleErrors.push({
      url: observedPage.url(),
      text: message.text(),
      location: message.location(),
    });
  });
  observedPage.on("pageerror", (error) => {
    runtime.pageErrors.push({
      url: observedPage.url(),
      ...serializableError(error),
    });
  });
  observedPage.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "Unknown request failure";
    if (
      request.method() === "GET" &&
      request.resourceType() === "fetch" &&
      request.url().includes("_rsc=") &&
      errorText === "net::ERR_ABORTED"
    ) {
      // Next may cancel a speculative RSC prefetch when the verified navigation
      // wins. This is not a failed product request.
      return;
    }
    runtime.requestFailures.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
      errorText,
    });
  });
  observedPage.on("response", (response) => {
    if (response.status() < 400) return;
    runtime.httpErrors.push({
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      status: response.status(),
      url: response.url(),
    });
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
  observeRuntime(page);

  await visit(page, "/");
  await verifyLiveAiReadiness(page, EXPECTED_READINESS_STATE);

  if (!READINESS_ONLY) {
  await verifySharedNavigation(page, "home");
  const createNavigationPage = await context.newPage();
  observeRuntime(createNavigationPage);
  try {
    await visit(createNavigationPage, CREATE_ROUTE);
    await verifySharedNavigation(createNavigationPage, "create");
    await poll(
      "the embedded Create Canvas project",
      () =>
        createNavigationPage
          .locator('#studio [data-embedded="true"] select option')
          .count(),
      (count) => count >= 1,
    );
    await verifyCreateSurface(createNavigationPage, "desktop");

    const embeddedCreateCanvas = createNavigationPage.locator(
      '#studio [data-embedded="true"]',
    );
    await embeddedCreateCanvas
      .getByRole("button", { name: "Library", exact: true })
      .click();
    const embeddedLibrary = createNavigationPage.getByRole("dialog", {
      name: "Your connected intelligence",
    });
    await embeddedLibrary.waitFor({ state: "visible" });
    const embeddedCurrentProject = embeddedLibrary.locator(
      'li[data-active="true"]',
    );
    check(
      "create.desktop.embedded-library-operational",
      (await embeddedCurrentProject.count()) === 1 &&
        (await embeddedCurrentProject.getByRole("button", {
          name: "Current",
          exact: true,
        }).isVisible()) &&
        (await embeddedCurrentProject.locator('button[title="Duplicate project"]').isVisible()) &&
        (await embeddedCurrentProject.locator('button[title="Export project bundle"]').isVisible()),
      {
        currentProject:
          (await embeddedCurrentProject.textContent())
            ?.replace(/\s+/g, " ")
            .trim() ?? "",
      },
    );
    await embeddedLibrary
      .getByRole("button", { name: "Close project library" })
      .click();
    await embeddedLibrary.waitFor({ state: "hidden" });

    await createNavigationPage
      .locator('section[aria-labelledby="create-heading"]')
      .screenshot({ path: path.join(REPORT_DIR, "create-desktop-hero.png") });
    await createNavigationPage.locator("#capabilities").screenshot({
      path: path.join(REPORT_DIR, "create-desktop-directions.png"),
    });
    await verifyCreatePageDirectionClicks(createNavigationPage, "desktop");
    await verifyCreateHeaderMenuDestinations(createNavigationPage, "desktop");

    await createNavigationPage.setViewportSize({ width: 390, height: 844 });
    await waitForCreateMobileStyles(createNavigationPage);
    await verifyCreateSurface(createNavigationPage, "mobile");
    await verifyCreatePageDirectionClicks(createNavigationPage, "mobile");
    await createNavigationPage
      .locator('section[aria-labelledby="create-heading"]')
      .screenshot({ path: path.join(REPORT_DIR, "create-mobile-hero.png") });
    await createNavigationPage.locator("#capabilities").screenshot({
      path: path.join(REPORT_DIR, "create-mobile-directions.png"),
    });
    await verifyCreateHeaderMenuDestinations(createNavigationPage, "mobile");
  } finally {
    await createNavigationPage.close();
  }
  const ideaInput = page.locator("#platform-project-start");
  await ideaInput.scrollIntoViewIfNeeded();
  await ideaInput.fill(IDEA);
  const ideaAction = page.getByRole("button", {
    name: /Start project/i,
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

  const projectLibraryButton = page.getByRole("button", { name: "Library", exact: true });
  await projectLibraryButton.click();
  const projectLibrary = page.getByRole("dialog", {
    name: "Your connected intelligence",
  });
  await projectLibrary.waitFor({ state: "visible" });
  const currentLibraryProject = projectLibrary.locator('li[data-active="true"]');
  const currentLibraryText =
    (await currentLibraryProject.textContent())?.replace(/\s+/g, " ").trim() ?? "";
  const duplicateControl = projectLibrary.getByRole("button", {
    name: `Duplicate ${IDEA}`,
    exact: true,
  });
  const exportControl = projectLibrary.getByRole("button", {
    name: `Export ${IDEA}`,
    exact: true,
  });
  check(
    "atlas.project-library.current-controls",
    (await projectLibrary.isVisible()) &&
      (await currentLibraryProject.count()) === 1 &&
      currentLibraryText.includes(IDEA) &&
      currentLibraryText.includes("Current") &&
      (await duplicateControl.isVisible()) &&
      (await duplicateControl.isEnabled()) &&
      (await exportControl.isVisible()) &&
      (await exportControl.isEnabled()),
    {
      currentProject: currentLibraryText,
      duplicateLabel: await duplicateControl.getAttribute("aria-label"),
      exportLabel: await exportControl.getAttribute("aria-label"),
    },
  );
  await projectLibrary.getByRole("button", { name: "Close project library" }).click();
  await projectLibrary.waitFor({ state: "hidden" });

  const conductorResultTab = page.locator("#workspace-result-tab-intelligence");
  check(
    "conductor.result-tab.available",
    (await conductorResultTab.isVisible()) &&
      (await conductorResultTab.getAttribute("role")) === "tab" &&
      (await conductorResultTab.getAttribute("aria-controls")) ===
        "workspace-intelligence-panel" &&
      (await conductorResultTab.textContent())?.trim() === "Conductor",
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

  const intelligenceCapabilityResponse = await context.request.get(
    `${BASE_URL}/api/intelligence/runs`,
  );
  const intelligenceCapabilityText = await intelligenceCapabilityResponse.text();
  let intelligenceCapability = null;
  try {
    intelligenceCapability = JSON.parse(intelligenceCapabilityText);
  } catch {
    // The demand below retains the raw excerpt for a deterministic diagnostic.
  }
  demand(
    "conductor.local-fallback-configured",
    intelligenceCapabilityResponse.ok() &&
      intelligenceCapability?.gateway === false &&
      intelligenceCapability?.mode === "local-fallback" &&
      intelligenceCapability?.usageProtectionConfigured === true &&
      intelligenceCapability?.automaticApplyEnabled === false &&
      intelligenceCapability?.gateApprovalMode === "human-only",
    {
      httpStatus: intelligenceCapabilityResponse.status(),
      mode: intelligenceCapability?.mode ?? null,
      gateway: intelligenceCapability?.gateway ?? null,
      usageProtectionConfigured:
        intelligenceCapability?.usageProtectionConfigured ?? null,
      responseExcerpt: intelligenceCapability
        ? undefined
        : intelligenceCapabilityText.slice(0, 500),
    },
  );

  const beforeConductorStored = await settledProject(
    page,
    (project) => project.id === appliedStored.project.id,
    "the pre-Conductor Atlas project",
  );
  const beforeConductorProject = beforeConductorStored.project;
  const revisionIdsBeforeConductor = asArray(beforeConductorProject.revisions).map(
    ({ id }) => id,
  );
  const gatesBeforeConductor = asArray(beforeConductorProject.gates).map(
    ({ id, phase, status, decisionId }) => ({ id, phase, status, decisionId }),
  );

  // Observe the page's actual fetch without manufacturing or replacing its
  // response. This proves the Conductor control performs its own same-origin
  // browser POST and renders the real governed local fallback.
  await page.evaluate(() => {
    const captureKey = "__kingxfordPlatformJourneyConductorCapture__";
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(
        typeof input === "string" ? input : request?.url ?? String(input),
        window.location.href,
      );
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      if (url.pathname !== "/api/intelligence/runs" || method !== "POST") {
        return nativeFetch(input, init);
      }

      const rawBody = typeof init?.body === "string"
        ? init.body
        : request
          ? await request.clone().text()
          : "";
      let body = null;
      try {
        body = JSON.parse(rawBody);
      } catch {
        // The real response and request excerpt diagnose malformed data below.
      }

      try {
        const response = await nativeFetch(input, init);
        const responseText = await response.clone().text();
        let responseBody = null;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          // Preserve a bounded raw excerpt when the route is not JSON.
        }
        window[captureKey] = {
          rawBody,
          body,
          response: {
            status: response.status,
            body: responseBody,
            responseExcerpt: responseBody ? null : responseText.slice(0, 500),
          },
          error: null,
        };
        return response;
      } catch (error) {
        window[captureKey] = {
          rawBody,
          body,
          response: null,
          error: {
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          },
        };
        throw error;
      }
    };
  });

  await conductorResultTab.click();
  const intelligencePanel = page.locator("#workspace-intelligence-panel");
  await intelligencePanel.waitFor({ state: "visible" });
  const nativeConductorResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/intelligence/runs",
    { timeout: 30_000 },
  );
  await intelligencePanel.getByRole("button", { name: "Run Conductor" }).click();
  const nativeConductorResponse = await nativeConductorResponsePromise;
  const conductorRequestHeaders =
    await nativeConductorResponse.request().allHeaders();
  const conductorCapture = await poll(
    "the native Conductor response",
    () =>
      page.evaluate(
        () => window.__kingxfordPlatformJourneyConductorCapture__ ?? null,
      ),
    Boolean,
    30_000,
  );
  demand(
    "conductor.request.native-route",
    conductorCapture.error === null &&
      nativeConductorResponse.status() === 200 &&
      conductorCapture.response?.status === 200 &&
      conductorRequestHeaders.origin === new URL(BASE_URL).origin &&
      conductorRequestHeaders["sec-fetch-site"] === "same-origin",
    {
      routeError: conductorCapture.error,
      httpStatus:
        conductorCapture.response?.status ?? nativeConductorResponse.status(),
      headers: {
        origin: conductorRequestHeaders.origin ?? null,
        host: conductorRequestHeaders.host ?? null,
        secFetchSite: conductorRequestHeaders["sec-fetch-site"] ?? null,
      },
      responseExcerpt: conductorCapture.response?.responseExcerpt ?? null,
    },
  );

  const conductorRequest = conductorCapture.body;
  const conductorSnapshot = conductorRequest?.projectGraphSnapshot;
  const conductorRevisionId = conductorRequest?.artifactRevisionId;
  const conductorArtifact = asArray(conductorSnapshot?.artifacts).find(
    (artifact) => artifact.activeRevision?.id === conductorRevisionId,
  );
  const conductorResponse = conductorCapture.response?.body;
  const expectedDeclinedCapabilities = [
    "external-research",
    "code-execution",
    "autonomous-deployment",
  ];
  check(
    "conductor.request.bounded-exact-atlas-binding",
    Buffer.byteLength(conductorCapture.rawBody ?? "", "utf8") <
      intelligenceCapability.limits.requestBytes &&
      snapshotWithinBounds(
        conductorSnapshot,
        intelligenceCapability.projectContext.bounds,
      ) &&
      typeof conductorRevisionId === "string" &&
      conductorArtifact?.activeRevision?.truncated === false &&
      conductorResponse?.projectContext?.projectId ===
        conductorRequest?.projectContext?.projectId &&
      conductorResponse?.projectContext?.snapshotId === conductorSnapshot?.id &&
      conductorResponse?.projectContext?.snapshotHash === conductorSnapshot?.hash &&
      conductorResponse?.projectContext?.snapshotSchemaVersion ===
        conductorSnapshot?.schemaVersion &&
      conductorResponse?.projectContext?.snapshotCharacterCount ===
        conductorSnapshot?.characterCount &&
      conductorResponse?.projectContext?.artifactRevisionId ===
        conductorRevisionId &&
      conductorResponse?.projectContext?.artifactId === conductorArtifact?.id &&
      conductorResponse?.projectContext?.draftHash ===
        conductorArtifact?.activeRevision?.contentHash,
    {
      requestBytes: Buffer.byteLength(conductorCapture.rawBody ?? "", "utf8"),
      requestLimit: intelligenceCapability.limits.requestBytes,
      projectId: conductorRequest?.projectContext?.projectId ?? null,
      snapshotId: conductorSnapshot?.id ?? null,
      snapshotHash: conductorSnapshot?.hash ?? null,
      artifactId: conductorArtifact?.id ?? null,
      artifactRevisionId: conductorRevisionId ?? null,
      draftHash: conductorArtifact?.activeRevision?.contentHash ?? null,
      echoedBinding: conductorResponse?.projectContext ?? null,
    },
  );
  check(
    "conductor.response.valid-local-orchestration",
    conductorResponse?.status === "local-fallback" &&
      conductorResponse?.source === "local" &&
      conductorResponse?.model === "local-readiness-rules-v1" &&
      conductorResponse?.agentRole === "conductor" &&
      typeof conductorResponse?.runId === "string" &&
      conductorResponse?.protocolVersion === intelligenceCapability.protocolVersion &&
      conductorResponse?.orchestration?.plan?.specialists?.length === 2 &&
      conductorResponse?.orchestration?.passes?.length === 2 &&
      conductorResponse.orchestration.passes.every(
        (pass) =>
          pass.status === "completed" &&
          pass.source === "local" &&
          Boolean(pass.review) &&
          typeof pass.artifactId === "string",
      ) &&
      JSON.stringify(
        conductorResponse.capabilityNegotiation.declined.map(
          ({ capability }) => capability,
        ),
      ) === JSON.stringify(expectedDeclinedCapabilities) &&
      conductorResponse.artifacts.length === 4 &&
      conductorResponse.provenance.providerCalls.length === 0 &&
      conductorResponse.provenance.usage.totalTokens === 0 &&
      conductorResponse.artifacts.some(
        (artifact) =>
          artifact.kind === "synthesis" &&
          artifact.id === conductorResponse.provenance.finalArtifactId,
      ),
    {
      status: conductorResponse?.status ?? null,
      source: conductorResponse?.source ?? null,
      model: conductorResponse?.model ?? null,
      protocolVersion: conductorResponse?.protocolVersion ?? null,
      planSpecialists:
        conductorResponse?.orchestration?.plan?.specialists?.map(
          ({ role }) => role,
        ) ?? null,
      passes:
        conductorResponse?.orchestration?.passes?.map(
          ({ role, status, source, artifactId }) => ({
            role,
            status,
            source,
            artifactId,
          }),
        ) ?? null,
      declinedCapabilities:
        conductorResponse?.capabilityNegotiation?.declined ?? null,
      provenance: conductorResponse?.provenance ?? null,
    },
  );

  const intelligenceTabs = intelligencePanel.getByRole("tablist", {
    name: "Project intelligence views",
  });
  await intelligenceTabs.getByRole("tab", { name: /^Conductor/ }).click();
  const conductorView = intelligencePanel.locator(
    '[role="tabpanel"][aria-labelledby$="-tab-conductor"]',
  );
  await conductorView.waitFor({ state: "visible" });
  const capabilityDenialsHeading = conductorView.getByRole("heading", {
    name: "Capabilities deliberately not granted",
  });
  const capabilityDenials = conductorView
    .getByRole("heading", { name: "Capabilities deliberately not granted" })
    .locator("xpath=ancestor::section[1]")
    .getByRole("listitem");
  check(
    "conductor.ui.plan-passes-and-capability-denials",
    (await conductorView.getByText("Typed phase plan", { exact: true }).isVisible()) &&
      (await conductorView.getByText("2 coordinated", { exact: true }).isVisible()) &&
      (await capabilityDenialsHeading.isVisible()) &&
      (await capabilityDenials.count()) === 3 &&
      expectedDeclinedCapabilities.every((capability) =>
        (conductorResponse.capabilityNegotiation.declined ?? []).some(
          (item) => item.capability === capability,
        ),
      ),
    {
      visiblePassCount: 2,
      visibleCapabilityDenialCount: await capabilityDenials.count(),
      phasePlan: conductorResponse.orchestration.plan.summary,
    },
  );

  await intelligenceTabs.getByRole("tab", { name: /^Provenance/ }).click();
  const provenanceView = intelligencePanel.locator(
    '[role="tabpanel"][aria-labelledby$="-tab-provenance"]',
  );
  await provenanceView.waitFor({ state: "visible" });
  const provenanceText =
    (await provenanceView.textContent())?.replace(/\s+/g, " ").trim() ?? "";
  check(
    "conductor.ui.provenance-and-exact-binding",
    (await provenanceView.getByText("Exact graph binding", { exact: true }).isVisible()) &&
      (await provenanceView.getByText("0 bounded calls", { exact: true }).isVisible()) &&
      provenanceText.includes(conductorResponse.runId) &&
      provenanceText.includes(conductorResponse.protocolVersion) &&
      provenanceText.includes(conductorResponse.projectContext.projectId) &&
      provenanceText.includes(conductorResponse.projectContext.snapshotId) &&
      provenanceText.includes(conductorResponse.projectContext.snapshotHash) &&
      provenanceText.includes(conductorResponse.projectContext.artifactId) &&
      provenanceText.includes(
        conductorResponse.projectContext.artifactRevisionId,
      ) &&
      provenanceText.includes(conductorResponse.projectContext.draftHash),
    {
      runId: conductorResponse.runId,
      providerCalls: conductorResponse.provenance.providerCalls.length,
      binding: conductorResponse.projectContext,
    },
  );

  await intelligenceTabs.getByRole("tab", { name: /^Conductor/ }).click();
  const acceptConductorButton = conductorView.getByRole("button", {
    name: "Accept as revision",
  });
  await acceptConductorButton.waitFor({ state: "visible" });
  demand(
    "conductor.accept.deliberate-control",
    await acceptConductorButton.isEnabled(),
    {
      ariaDisabled: await acceptConductorButton.getAttribute("aria-disabled"),
      runId: conductorResponse.runId,
    },
  );
  await acceptConductorButton.click();
  const acceptedConductorStored = await settledProject(
    page,
    (project) =>
      asArray(project.revisions).some(
        (revision) =>
          !revisionIdsBeforeConductor.includes(revision.id) &&
          revision.source === "agent-accepted",
      ),
    "the deliberately accepted Conductor revision",
  );
  const acceptedConductorRevision = asArray(
    acceptedConductorStored.project.revisions,
  ).find(
    (revision) =>
      !revisionIdsBeforeConductor.includes(revision.id) &&
      revision.source === "agent-accepted",
  );
  check(
    "conductor.accept.revision-without-gate-approval",
    Boolean(acceptedConductorRevision) &&
      acceptedConductorRevision?.parentRevisionId ===
        conductorResponse.projectContext.artifactRevisionId &&
      acceptedConductorRevision?.contentHash ===
        conductorResponse.projectContext.draftHash &&
      asArray(acceptedConductorStored.project.revisions).length >
        asArray(beforeConductorProject.revisions).length &&
      JSON.stringify(
        asArray(acceptedConductorStored.project.gates).map(
          ({ id, phase, status, decisionId }) => ({
            id,
            phase,
            status,
            decisionId,
          }),
        ),
      ) === JSON.stringify(gatesBeforeConductor) &&
      asArray(acceptedConductorStored.project.gates).every(
        ({ status }) => status !== "approved",
      ) &&
      asArray(acceptedConductorStored.project.reviewLinks).some(
        ({ requestId }) => requestId === conductorResponse.runId,
      ),
    {
      runId: conductorResponse.runId,
      acceptedRevisionId: acceptedConductorRevision?.id ?? null,
      acceptedRevisionSource: acceptedConductorRevision?.source ?? null,
      beforeRevisionCount: beforeConductorProject.revisions.length,
      afterRevisionCount: acceptedConductorStored.project.revisions.length,
      gatesBefore: gatesBeforeConductor,
      gatesAfter: acceptedConductorStored.project.gates.map(
        ({ id, phase, status, decisionId }) => ({ id, phase, status, decisionId }),
      ),
    },
  );
  }

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
