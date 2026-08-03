import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { brotliDecompress } from "node:zlib";

import chromiumBinary from "@sparticuz/chromium";
import { chromium } from "playwright-core";

const baseUrl = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.resolve("verification");
await fs.mkdir(outputDir, { recursive: true });

// Some container filesystems reject the ownership metadata inside Sparticuz's
// font archive. Pre-inflating only the browser binary avoids that unrelated
// archive operation while preserving the same Chromium build for UI checks.
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
  "--in-process-gpu",
  "--single-process",
  "--use-angle=swiftshader",
  "--use-gl=angle",
  "--enable-unsafe-swiftshader",
]);
const browserArgs = chromiumBinary.args.filter(
  (argument) => !unsupportedArgs.has(argument),
);
browserArgs.push(
  "--disable-background-networking",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-sync",
  "--metrics-recording-only",
  "--no-first-run",
);
const browser = await chromium.launch({
  executablePath,
  args: browserArgs,
  headless: true,
});

const results = [];
const failures = [];

async function inspectPage(name, route, viewport, options = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: options.colorScheme ?? "dark",
    reducedMotion: options.reducedMotion ?? "no-preference",
    hasTouch: options.hasTouch ?? false,
    isMobile: options.isMobile ?? false,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    const expectedNotFoundConsole =
      options.expectedStatus === 404 &&
      message.type() === "error" &&
      /failed to load resource.*404/i.test(message.text());
    if (
      message.type() === "error" &&
      !message.text().includes("ERR_BLOCKED_BY_CLIENT") &&
      !expectedNotFoundConsole
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("main");
  await page.waitForTimeout(650);
  if (options.scrollSelector) {
    await page.locator(options.scrollSelector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(220);
  }
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: options.fullPage ?? false,
  });

  const audit = await page.evaluate(() => {
    const unnamedInteractive = [
      ...document.querySelectorAll("a,button,input,summary"),
    ]
      .filter((element) => {
        const label =
          element.getAttribute("aria-label") ??
          element.getAttribute("aria-labelledby") ??
          element.getAttribute("title") ??
          element.textContent ??
          "";
        const formLabels =
          "labels" in element && element.labels ? element.labels.length : 0;
        return label.trim().length === 0 && formLabels === 0;
      })
      .map((element) => element.outerHTML.slice(0, 140));

    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);

    const duplicateIds = [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);

    return {
      title: document.title,
      bodyTextLength: document.body.innerText.trim().length,
      hasMain: Boolean(document.querySelector("main")),
      hasErrorOverlay: Boolean(
        document.querySelector(
          "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
        ),
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      brokenImages,
      unnamedInteractive,
      duplicateIds: [...new Set(duplicateIds)],
      headingCount: document.querySelectorAll("h1,h2,h3").length,
      linkCount: document.querySelectorAll("a[href]").length,
    };
  });

  const record = {
    name,
    route,
    viewport,
    status: response?.status() ?? null,
    expectedStatus: options.expectedStatus ?? null,
    consoleErrors,
    pageErrors,
    audit,
  };
  results.push(record);

  const responsePassed =
    options.expectedStatus === undefined
      ? response?.ok()
      : response?.status() === options.expectedStatus;

  if (
    !responsePassed ||
    audit.bodyTextLength < 80 ||
    !audit.hasMain ||
    audit.hasErrorOverlay ||
    audit.horizontalOverflow ||
    audit.brokenImages.length ||
    audit.unnamedInteractive.length ||
    audit.duplicateIds.length ||
    consoleErrors.length ||
    pageErrors.length
  ) {
    failures.push(record);
  }

  return { context, page, record };
}

const desktop = await inspectPage(
  "home-desktop-1440",
  "/",
  { width: 1440, height: 1000 },
);

const selectedDesktopTheme = desktop.page.locator(
  ".site-header__theme [role='radio'][aria-checked='true']",
);
await selectedDesktopTheme.focus();
await desktop.page.keyboard.press("ArrowLeft");
const desktopThemeKeyboard = await desktop.page
  .locator(".site-header__theme [role='radio'][aria-checked='true']")
  .evaluate(
    (element) =>
      element === document.activeElement &&
      element.getAttribute("aria-label") === "Dark theme",
  );
results.push({
  interaction: "theme-radio-keyboard",
  passed: desktopThemeKeyboard,
});
if (!desktopThemeKeyboard) {
  failures.push({ interaction: "theme-radio-keyboard" });
}

await desktop.page.keyboard.press("Control+K");
await desktop.page.waitForSelector("dialog[open]");
await desktop.page.waitForFunction(
  () => document.activeElement?.id === "command-palette-search",
);
await desktop.page.waitForTimeout(80);
const commandPaletteOpen = await desktop.page
  .locator("dialog[open]")
  .isVisible();
results.push({ interaction: "command-palette", passed: commandPaletteOpen });
if (!commandPaletteOpen) failures.push({ interaction: "command-palette" });
const commandSearchFocus = await desktop.page
  .locator("#command-palette-search")
  .evaluate((element) => {
    const style = getComputedStyle(element);
    return (
      element === document.activeElement &&
      style.outlineStyle !== "none" &&
      style.outlineWidth !== "0px"
    );
  });
results.push({
  interaction: "command-search-focus",
  passed: commandSearchFocus,
});
if (!commandSearchFocus) {
  failures.push({ interaction: "command-search-focus" });
}
await desktop.page.locator("#command-palette-search").fill("science lab");
await desktop.page.waitForTimeout(120);
const scienceLabCommandResults = await desktop.page
  .locator("#command-palette-results [role='option']")
  .evaluateAll((options) =>
    options.map((option) => ({
      id: option.id,
      text: option.textContent?.replace(/\s+/g, " ").trim() ?? "",
    })),
  );
const scienceLabCommandPassed = scienceLabCommandResults.some(
  (result) =>
    result.id === "command-create" &&
    /create/i.test(result.text) &&
    /websites?/i.test(result.text),
);
results.push({
  interaction: "command-search-science-lab",
  passed: scienceLabCommandPassed,
  results: scienceLabCommandResults,
});
if (!scienceLabCommandPassed) {
  failures.push({
    interaction: "command-search-science-lab",
    results: scienceLabCommandResults,
  });
}
await desktop.page.locator(".command-palette__close").click();
await desktop.page
  .locator("dialog.command-palette[open]")
  .waitFor({ state: "hidden" });

const missionImage = desktop.page.locator(
  ".kx-reality-plate[data-plate='mission'] img",
);
await missionImage.waitFor({ state: "visible" });
await desktop.page.waitForFunction(() => {
  const image = document.querySelector(
    ".kx-reality-plate[data-plate='mission'] img",
  );
  return (
    image instanceof HTMLImageElement &&
    image.complete &&
    image.naturalWidth > 0
  );
});

const storyMetrics = await desktop.page.locator(".kx-cinematic").evaluate((story) => {
  const stage = story.querySelector(".kx-cinematic__stage");
  const arrival = story.querySelector(
    ".kx-reality-plate[data-plate='mission'] img",
  );
  const rect = story.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    height: rect.height,
    viewportHeight: window.innerHeight,
    chapterCount: story.querySelectorAll(".kx-cinematic__chapter").length,
    plateCount: story.querySelectorAll(".kx-reality-plate").length,
    videoCount: story.querySelectorAll("video").length,
    stagePosition: stage ? getComputedStyle(stage).position : null,
    arrivalReady:
      arrival instanceof HTMLImageElement &&
      arrival.complete &&
      arrival.naturalWidth > 0,
  };
});
const storyStructurePassed =
  storyMetrics.chapterCount === 6 &&
  storyMetrics.plateCount === 6 &&
  storyMetrics.videoCount === 0 &&
  storyMetrics.stagePosition === "sticky" &&
  storyMetrics.arrivalReady &&
  storyMetrics.height > storyMetrics.viewportHeight * 6;
results.push({
  interaction: "kingxford-cinematic-structure",
  passed: storyStructurePassed,
  ...storyMetrics,
});
if (!storyStructurePassed) {
  failures.push({
    interaction: "kingxford-cinematic-structure",
    ...storyMetrics,
  });
}

await desktop.page.addStyleTag({
  content: "html, body { scroll-behavior: auto !important; }",
});

for (const [captureName, expectedChapter, progress] of [
  ["mission", "mission", 0.05],
  ["intelligence", "intelligence", 0.27],
  ["research-development", "research-development", 0.445],
  ["responsible-ai", "responsible-ai", 0.625],
  ["and-co", "and-co", 0.79],
  ["abundant-future", "abundant-future", 0.95],
]) {
  await desktop.page.evaluate(
    ({ top, height, viewportHeight, progress }) => {
      window.scrollTo({
        top: top + (height - viewportHeight) * progress,
        behavior: "auto",
      });
    },
    {
      top: storyMetrics.top,
      height: storyMetrics.height,
      viewportHeight: storyMetrics.viewportHeight,
      progress,
    },
  );
  await desktop.page.waitForTimeout(180);
  const chapterVisibility = await desktop.page
    .locator(".kx-cinematic__chapter")
    .evaluateAll((chapters) =>
      chapters.map((chapter) => ({
        id: chapter.getAttribute("data-chapter"),
        opacity: Number.parseFloat(getComputedStyle(chapter).opacity),
      })),
    );
  const visibleChapters = chapterVisibility.filter(
    (chapter) => chapter.opacity > 0.05,
  );
  const chapterIsolationPassed =
    visibleChapters.length === 1 &&
    visibleChapters[0].id === expectedChapter &&
    visibleChapters[0].opacity > 0.95;
  results.push({
    interaction: `chapter-isolation-${expectedChapter}`,
    passed: chapterIsolationPassed,
    chapterVisibility,
  });
  if (!chapterIsolationPassed) {
    failures.push({
      interaction: `chapter-isolation-${expectedChapter}`,
      chapterVisibility,
    });
  }
  await desktop.page.screenshot({
    path: path.join(outputDir, `kingxford-${captureName}.png`),
    fullPage: false,
  });
}

await desktop.page.locator(".worlds__portal").scrollIntoViewIfNeeded();
await desktop.page.locator("#living-room").hover();
await desktop.page.waitForTimeout(250);
const activeWorld = await desktop.page
  .locator(".world-panel[data-active='true']")
  .getAttribute("id");
results.push({
  interaction: "three-world-portal",
  passed:
    (await desktop.page.locator(".world-panel").count()) === 3 &&
    activeWorld === "living-room",
  activeWorld,
});
if (activeWorld !== "living-room") {
  failures.push({ interaction: "three-world-portal", activeWorld });
}
await desktop.page.screenshot({
  path: path.join(outputDir, "kingxford-three-worlds.png"),
  fullPage: false,
});

await desktop.page.locator(".idea-router").scrollIntoViewIfNeeded();
await desktop.page
  .locator("#idea-router-input")
  .fill("A research platform for scientific evidence and academic data");
await desktop.page.waitForTimeout(250);
const routedWorld = await desktop.page
  .locator(".idea-router__result strong")
  .textContent();
results.push({
  interaction: "idea-router",
  passed: routedWorld?.trim() === "Lab",
  routedWorld,
});
if (routedWorld?.trim() !== "Lab") {
  failures.push({ interaction: "idea-router", routedWorld });
}
await desktop.page.screenshot({
  path: path.join(outputDir, "kingxford-idea-router.png"),
  fullPage: false,
});

await desktop.context.close();

const work = await inspectPage(
  "work-desktop-1440",
  "/work",
  { width: 1440, height: 1000 },
);
const filter = work.page.getByRole("button", { name: "AI Experience" });
await filter.click();
const filterSelected = await filter.getAttribute("aria-pressed");
const filteredCards = await work.page.locator(".project-card").count();
results.push({
  interaction: "work-filter",
  passed: filterSelected === "true" && filteredCards > 0,
  filteredCards,
});
if (filterSelected !== "true" || filteredCards === 0) {
  failures.push({ interaction: "work-filter", filteredCards });
}
await work.page.screenshot({
  path: path.join(outputDir, "work-filtered.png"),
  fullPage: false,
});
await work.context.close();

const expectedCreateShowcases = [
  {
    slug: "lumen-vale-laboratory",
    name: "Lumen Vale Laboratory",
    sector: "science",
    heading: "Evidence should arrive with its history intact.",
  },
  {
    slug: "meridian-financial-office",
    name: "Meridian Financial Office",
    sector: "finance",
    heading: "A decision should survive the meeting.",
  },
  {
    slug: "commonfield-institute",
    name: "Commonfield Institute",
    sector: "education",
    heading: "A curriculum that starts with a real question.",
  },
];

const create = await inspectPage(
  "create-desktop-1440",
  "/create",
  { width: 1440, height: 1000 },
);
const createIndexState = await create.page.evaluate((expectedShowcases) => {
  const gallery = document.querySelector("[data-prototype-gallery]");
  const tabs = [...gallery?.querySelectorAll("[role='tab']") ?? []];
  const navLinks = [
    ...document.querySelectorAll(".site-header__nav-link[href='/create']"),
  ];
  const schemaNode = document.querySelector("#create-collection-schema");
  let schema = null;
  try {
    schema = schemaNode?.textContent ? JSON.parse(schemaNode.textContent) : null;
  } catch {
    schema = null;
  }

  return {
    heading: document.querySelector("#create-heading")?.textContent?.trim() ?? "",
    featuredCount: tabs.length,
    activeSector: gallery?.getAttribute("data-sector") ?? null,
    selectedTabCount: tabs.filter((tab) => tab.getAttribute("aria-selected") === "true").length,
    liveControlCount: gallery?.querySelectorAll("#active-prototype button").length ?? 0,
    expectedHrefs: expectedShowcases
      .map(({ slug }) => `/create/${slug}`)
      .sort(),
    catalogueCount: document.querySelectorAll(
      "section[aria-labelledby='catalogue-heading'] article[id]",
    ).length,
    currentNav:
      navLinks.length > 0 &&
      navLinks.every((link) => link.getAttribute("aria-current") === "page"),
    schemaType: schema?.["@type"] ?? null,
    schemaPartCount: Array.isArray(schema?.hasPart) ? schema.hasPart.length : 0,
  };
}, expectedCreateShowcases);

const prototypeStates = [];
for (const expected of expectedCreateShowcases) {
  const tab = create.page.locator(`#prototype-tab-${expected.sector}`);
  await tab.click();
  await create.page.waitForTimeout(380);
  prototypeStates.push(
    await create.page.locator("[data-prototype-gallery]").evaluate((gallery) => ({
      sector: gallery.getAttribute("data-sector"),
      href: gallery.querySelector("a[href^='/create/']")?.getAttribute("href") ?? null,
      liveControls: gallery.querySelectorAll("#active-prototype button").length,
      panelText: gallery.querySelector("#active-prototype")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    })),
  );
}

const createIndexPassed =
  createIndexState.heading === "What should exist next?" &&
  createIndexState.featuredCount === 3 &&
  createIndexState.activeSector === "science" &&
  createIndexState.selectedTabCount === 1 &&
  createIndexState.liveControlCount >= 3 &&
  JSON.stringify(prototypeStates.map((state) => state.sector)) ===
    JSON.stringify(expectedCreateShowcases.map((showcase) => showcase.sector)) &&
  JSON.stringify(prototypeStates.map((state) => state.href).sort()) ===
    JSON.stringify(createIndexState.expectedHrefs) &&
  prototypeStates.every((state) => state.liveControls >= 3 && state.panelText.length > 120) &&
  createIndexState.catalogueCount === 7 &&
  createIndexState.currentNav &&
  createIndexState.schemaType === "CollectionPage" &&
  createIndexState.schemaPartCount === 4;
results.push({
  interaction: "create-index",
  passed: createIndexPassed,
  ...createIndexState,
  prototypeStates,
});
if (!createIndexPassed) {
  failures.push({ interaction: "create-index", ...createIndexState, prototypeStates });
}

const sitemapResponse = await create.context.request.get(
  `${baseUrl}/sitemap.xml`,
);
const sitemapText = await sitemapResponse.text();
const expectedCreateSitemapPaths = [
  "/create",
  "/create/workspace",
  ...expectedCreateShowcases.map(({ slug }) => `/create/${slug}`),
];
const missingCreateSitemapPaths = expectedCreateSitemapPaths.filter(
  (route) => !sitemapText.includes(route),
);
const createSitemapPassed =
  sitemapResponse.ok() && missingCreateSitemapPaths.length === 0;
results.push({
  interaction: "create-sitemap",
  passed: createSitemapPassed,
  status: sitemapResponse.status(),
  missingPaths: missingCreateSitemapPaths,
});
if (!createSitemapPassed) {
  failures.push({
    interaction: "create-sitemap",
    status: sitemapResponse.status(),
    missingPaths: missingCreateSitemapPaths,
  });
}
await create.context.close();

const canvas = await inspectPage(
  "canvas-desktop-1440",
  "/create/workspace",
  { width: 1440, height: 1000 },
);
const canvasAgentRequests = [];
const canvasPostRequests = [];
canvas.page.on("request", (request) => {
  if (request.url().includes("/api/workspace/agent")) {
    canvasAgentRequests.push({
      method: request.method(),
      url: request.url(),
    });
  }
  if (request.method() === "POST") {
    canvasPostRequests.push(request.url());
  }
});

async function readMapElementState(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      inlineTransform: element instanceof HTMLElement
        ? element.style.transform
        : "",
      computedTransform: getComputedStyle(element).transform,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

function mapElementMoved(before, after, minimum = 8) {
  return (
    Math.hypot(after.left - before.left, after.top - before.top) >= minimum ||
    before.inlineTransform !== after.inlineTransform ||
    before.computedTransform !== after.computedTransform
  );
}

function mapElementStable(before, after, tolerance = 2) {
  return (
    Math.abs(after.left - before.left) <= tolerance &&
    Math.abs(after.top - before.top) <= tolerance &&
    Math.abs(after.width - before.width) <= tolerance &&
    Math.abs(after.height - before.height) <= tolerance &&
    before.computedTransform === after.computedTransform
  );
}

async function findMapBackgroundPoint(viewport) {
  return viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const visible = {
      left: Math.max(rect.left, 0) + 10,
      right: Math.min(rect.right, innerWidth) - 10,
      top: Math.max(rect.top, 0) + 10,
      bottom: Math.min(rect.bottom, innerHeight) - 10,
    };
    if (
      visible.right - visible.left < 90 ||
      visible.bottom - visible.top < 90
    ) {
      throw new Error("The interactive map canvas has no usable visible area.");
    }

    const ratios = [0.82, 0.68, 0.5, 0.32, 0.18];
    const moves = [
      [48, 30],
      [-48, 30],
      [48, -30],
      [-48, -30],
    ];
    for (const yRatio of ratios) {
      for (const xRatio of ratios) {
        const x = visible.left + (visible.right - visible.left) * xRatio;
        const y = visible.top + (visible.bottom - visible.top) * yRatio;
        const target = document.elementFromPoint(x, y);
        if (
          !target ||
          !element.contains(target) ||
          target.closest(
            "[data-map-node-id], button, a, input, textarea, select",
          )
        ) {
          continue;
        }
        for (const [dx, dy] of moves) {
          const endX = x + dx;
          const endY = y + dy;
          if (
            endX >= visible.left &&
            endX <= visible.right &&
            endY >= visible.top &&
            endY <= visible.bottom
          ) {
            return {
              x,
              y,
              dx,
              dy,
              hitTag: target.tagName,
            };
          }
        }
      }
    }
    throw new Error(
      "No unobscured map background point is available for pointer verification.",
    );
  });
}

async function findHittableMapNodePoint(nodes) {
  return nodes.evaluateAll((elements) => {
    for (const [index, element] of elements.entries()) {
      const rect = element.getBoundingClientRect();
      const candidates = [
        [0.72, 0.5],
        [0.55, 0.5],
        [0.84, 0.72],
        [0.84, 0.28],
      ];
      for (const [xRatio, yRatio] of candidates) {
        const x = rect.left + rect.width * xRatio;
        const y = rect.top + rect.height * yRatio;
        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) continue;
        const target = document.elementFromPoint(x, y);
        if (
          target &&
          element.contains(target) &&
          !target.closest("button")
        ) {
          return {
            index,
            nodeId: element.getAttribute("data-map-node-id"),
            x,
            y,
            hitTag: target.tagName,
            hitNodeId:
              target
                .closest("[data-map-node-id]")
                ?.getAttribute("data-map-node-id") ?? null,
          };
        }
      }
    }
    return null;
  });
}

async function readMapZoom(mapPreview) {
  const text = await mapPreview
    .getByRole("group", { name: "Map zoom controls" })
    .textContent();
  const match = text?.match(/(\d+)%/);
  return match ? Number(match[1]) : null;
}

const canvasRouteState = await canvas.page.evaluate(() => {
  const schemaNode = document.querySelector("#kingxford-canvas-schema");
  let schema = null;
  try {
    schema = schemaNode?.textContent
      ? JSON.parse(schemaNode.textContent)
      : null;
  } catch {
    schema = null;
  }

  return {
    heading: document.querySelector("#canvas-title")?.textContent?.trim() ?? "",
    modeCount: document.querySelectorAll("[role='tab'][id^='workspace-mode-']").length,
    selectedMode:
      document
        .querySelector("[role='tab'][id^='workspace-mode-'][aria-selected='true']")
        ?.getAttribute("id") ?? null,
    hasWorkbench: Boolean(
      document.querySelector("[aria-label='Creative input workbench']"),
    ),
    hasResultPane: Boolean(
      document.querySelector("[aria-label='Live result and agent review']"),
    ),
    schemaType: schema?.["@type"] ?? null,
  };
});
const canvasRoutePassed =
  canvas.record.status === 200 &&
  canvasRouteState.heading === "Move from first thought to working proof." &&
  canvasRouteState.modeCount === 5 &&
  canvasRouteState.selectedMode === "workspace-mode-idea" &&
  canvasRouteState.hasWorkbench &&
  canvasRouteState.hasResultPane &&
  canvasRouteState.schemaType === "WebApplication";
results.push({
  interaction: "canvas-route-desktop",
  passed: canvasRoutePassed,
  ...canvasRouteState,
});
if (!canvasRoutePassed) {
  failures.push({
    interaction: "canvas-route-desktop",
    status: canvas.record.status,
    ...canvasRouteState,
  });
}

const canvasModeChecks = [];
for (const expected of [
  { mode: "idea", previewSelector: "[aria-label='Local concept preview']", text: "Concept specimen" },
  { mode: "code", previewSelector: "iframe[title='Live code preview']", text: "Isolated browser" },
  { mode: "mindmap", previewSelector: "[aria-label='Mind map preview']", text: "Relationship view" },
  { mode: "prompt", previewSelector: "#workspace-preview-panel article", text: "Prompt instrument" },
  { mode: "brief", previewSelector: "#workspace-preview-panel article", text: "Working production brief" },
]) {
  const tab = canvas.page.locator(`#workspace-mode-${expected.mode}`);
  await tab.click();
  await canvas.page.waitForTimeout(90);
  const preview = canvas.page.locator(expected.previewSelector);
  const state = {
    mode: expected.mode,
    selected: (await tab.getAttribute("aria-selected")) === "true",
    previewVisible: await preview.isVisible(),
    expectedTextVisible: (await canvas.page
      .locator("#workspace-preview-panel")
      .textContent())?.includes(expected.text) ?? false,
  };
  state.passed =
    state.selected && state.previewVisible && state.expectedTextVisible;
  canvasModeChecks.push(state);
}
const canvasModesPassed =
  canvasModeChecks.length === 5 &&
  canvasModeChecks.every((state) => state.passed);
results.push({
  interaction: "canvas-five-creation-modes",
  passed: canvasModesPassed,
  modes: canvasModeChecks,
});
if (!canvasModesPassed) {
  failures.push({
    interaction: "canvas-five-creation-modes",
    modes: canvasModeChecks,
  });
}

await canvas.page.locator("#workspace-mode-mindmap").click();
const canvasMapPreview = canvas.page.locator(
  "[aria-label='Mind map preview']",
);
const canvasMapViewport = canvasMapPreview.locator("[data-map-viewport]");
const canvasMapSurface = canvasMapPreview.locator("[data-map-canvas]");
const canvasMapNodes = canvasMapPreview.locator("[data-map-node-id]");
await canvasMapViewport.waitFor({ state: "visible" });
const canvasMapNodeCount = await canvasMapNodes.count();
const canvasMapFirstNode = canvasMapPreview
  .locator("[data-map-node-id][data-map-parent-id]")
  .first();
const canvasMapConnectionId = await canvasMapFirstNode.evaluate((node) =>
  `${node.getAttribute("data-map-parent-id")}->${node.getAttribute("data-map-node-id")}`,
);
const canvasMapConnection = canvasMapPreview.locator(
  `[data-map-connection-id="${canvasMapConnectionId}"]`,
);
await canvasMapConnection.waitFor({ state: "attached" });
const initialMapSurface = await readMapElementState(canvasMapSurface);
const initialMapNode = await readMapElementState(canvasMapFirstNode);
const initialMapNodeRelative = {
  left: initialMapNode.left - initialMapSurface.left,
  top: initialMapNode.top - initialMapSurface.top,
};

const mapBackgroundPoint = await findMapBackgroundPoint(canvasMapViewport);
await canvas.page.mouse.move(mapBackgroundPoint.x, mapBackgroundPoint.y);
await canvas.page.mouse.down();
await canvas.page.mouse.move(
  mapBackgroundPoint.x + mapBackgroundPoint.dx,
  mapBackgroundPoint.y + mapBackgroundPoint.dy,
  { steps: 5 },
);
await canvas.page.mouse.up();
await canvas.page.waitForTimeout(220);
const pannedMapSurface = await readMapElementState(canvasMapSurface);
const canvasMapPanPassed =
  canvasMapNodeCount >= 2 &&
  mapElementMoved(initialMapSurface, pannedMapSurface, 14);
results.push({
  interaction: "canvas-mindmap-background-pan",
  passed: canvasMapPanPassed,
  nodeCount: canvasMapNodeCount,
  before: initialMapSurface,
  after: pannedMapSurface,
});
if (!canvasMapPanPassed) {
  failures.push({
    interaction: "canvas-mindmap-background-pan",
    nodeCount: canvasMapNodeCount,
    before: initialMapSurface,
    after: pannedMapSurface,
  });
}

const mapNodeBeforeDrag = await readMapElementState(canvasMapFirstNode);
const mapSurfaceBeforeNodeDrag = await readMapElementState(canvasMapSurface);
const mapConnectionBeforeDrag = await canvasMapConnection.getAttribute("d");
const mapNodeBox = await canvasMapFirstNode.boundingBox();
if (!mapNodeBox) {
  throw new Error("The first draggable mind-map node has no visible bounds.");
}
await canvas.page.mouse.move(
  mapNodeBox.x + mapNodeBox.width / 2,
  mapNodeBox.y + mapNodeBox.height / 2,
);
await canvas.page.mouse.down();
await canvas.page.mouse.move(
  mapNodeBox.x + mapNodeBox.width / 2 + 42,
  mapNodeBox.y + mapNodeBox.height / 2 - 28,
  { steps: 5 },
);
await canvas.page.mouse.up();
await canvas.page.waitForTimeout(180);
const mapNodeAfterDrag = await readMapElementState(canvasMapFirstNode);
const mapSurfaceAfterNodeDrag = await readMapElementState(canvasMapSurface);
const mapConnectionAfterDrag = await canvasMapConnection.getAttribute("d");
const canvasMapNodeDragPassed =
  mapElementMoved(mapNodeBeforeDrag, mapNodeAfterDrag, 14) &&
  mapElementStable(mapSurfaceBeforeNodeDrag, mapSurfaceAfterNodeDrag) &&
  Boolean(mapConnectionBeforeDrag) &&
  mapConnectionAfterDrag !== mapConnectionBeforeDrag;
results.push({
  interaction: "canvas-mindmap-node-independent-drag",
  passed: canvasMapNodeDragPassed,
  connectionId: canvasMapConnectionId,
  connectionBefore: mapConnectionBeforeDrag,
  connectionAfter: mapConnectionAfterDrag,
  nodeBefore: mapNodeBeforeDrag,
  nodeAfter: mapNodeAfterDrag,
  canvasBefore: mapSurfaceBeforeNodeDrag,
  canvasAfter: mapSurfaceAfterNodeDrag,
});
if (!canvasMapNodeDragPassed) {
  failures.push({
    interaction: "canvas-mindmap-node-independent-drag",
    connectionId: canvasMapConnectionId,
    connectionBefore: mapConnectionBeforeDrag,
    connectionAfter: mapConnectionAfterDrag,
    nodeBefore: mapNodeBeforeDrag,
    nodeAfter: mapNodeAfterDrag,
    canvasBefore: mapSurfaceBeforeNodeDrag,
    canvasAfter: mapSurfaceAfterNodeDrag,
  });
}

await canvasMapPreview
  .getByRole("button", { name: "Reset map layout" })
  .click();
await canvas.page.waitForTimeout(240);
const resetMapNode = await readMapElementState(canvasMapFirstNode);
const resetMapSurface = await readMapElementState(canvasMapSurface);
const mapConnectionAfterReset = await canvasMapConnection.getAttribute("d");
const resetMapNodeRelative = {
  left: resetMapNode.left - resetMapSurface.left,
  top: resetMapNode.top - resetMapSurface.top,
};
const canvasMapResetPassed =
  Math.abs(resetMapNodeRelative.left - initialMapNodeRelative.left) <= 3 &&
  Math.abs(resetMapNodeRelative.top - initialMapNodeRelative.top) <= 3 &&
  mapElementStable(initialMapNode, resetMapNode, 3) &&
  mapElementStable(initialMapSurface, resetMapSurface, 3) &&
  mapConnectionAfterReset === mapConnectionBeforeDrag;
results.push({
  interaction: "canvas-mindmap-reset-layout",
  passed: canvasMapResetPassed,
  connectionId: canvasMapConnectionId,
  connectionBefore: mapConnectionBeforeDrag,
  connectionAfterDrag: mapConnectionAfterDrag,
  connectionAfterReset: mapConnectionAfterReset,
  initialRelative: initialMapNodeRelative,
  resetRelative: resetMapNodeRelative,
  canvasInitial: initialMapSurface,
  canvasBefore: mapSurfaceAfterNodeDrag,
  canvasAfter: resetMapSurface,
});
if (!canvasMapResetPassed) {
  failures.push({
    interaction: "canvas-mindmap-reset-layout",
    connectionId: canvasMapConnectionId,
    connectionBefore: mapConnectionBeforeDrag,
    connectionAfterDrag: mapConnectionAfterDrag,
    connectionAfterReset: mapConnectionAfterReset,
    initialRelative: initialMapNodeRelative,
    resetRelative: resetMapNodeRelative,
    canvasInitial: initialMapSurface,
    canvasBefore: mapSurfaceAfterNodeDrag,
    canvasAfter: resetMapSurface,
  });
}

const canvasMapZoomBefore = await readMapZoom(canvasMapPreview);
await canvasMapPreview.getByRole("button", { name: "Zoom in" }).click();
await canvas.page.waitForTimeout(80);
const canvasMapZoomedIn = await readMapZoom(canvasMapPreview);
await canvasMapPreview.getByRole("button", { name: "Zoom out" }).click();
await canvas.page.waitForTimeout(80);
const canvasMapZoomedBack = await readMapZoom(canvasMapPreview);
const canvasMapZoomPassed =
  canvasMapZoomBefore !== null &&
  canvasMapZoomedIn !== null &&
  canvasMapZoomedBack !== null &&
  canvasMapZoomedIn > canvasMapZoomBefore &&
  canvasMapZoomedBack === canvasMapZoomBefore;
results.push({
  interaction: "canvas-mindmap-zoom-controls",
  passed: canvasMapZoomPassed,
  before: canvasMapZoomBefore,
  zoomedIn: canvasMapZoomedIn,
  zoomedBack: canvasMapZoomedBack,
});
if (!canvasMapZoomPassed) {
  failures.push({
    interaction: "canvas-mindmap-zoom-controls",
    before: canvasMapZoomBefore,
    zoomedIn: canvasMapZoomedIn,
    zoomedBack: canvasMapZoomedBack,
  });
}

await canvasMapPreview.getByRole("button", { name: "Zoom in" }).click();
await canvasMapPreview.getByRole("button", { name: "Zoom in" }).click();
await canvas.page.waitForTimeout(220);
const mapSurfaceBeforeFit = await readMapElementState(canvasMapSurface);
const canvasMapZoomBeforeFit = await readMapZoom(canvasMapPreview);
await canvasMapPreview.getByRole("button", { name: "Fit map" }).click();
await canvas.page.waitForTimeout(240);
const mapSurfaceAfterFit = await readMapElementState(canvasMapSurface);
const canvasMapZoomAfterFit = await readMapZoom(canvasMapPreview);
const canvasMapFitGeometry = await canvasMapPreview.evaluate((preview) => {
  const viewport = preview.querySelector("[data-map-viewport]");
  const nodes = [...preview.querySelectorAll("[data-map-node-id]")];
  if (!viewport || nodes.length === 0) {
    return { nodeCount: nodes.length, allNodesInside: false };
  }
  const bounds = viewport.getBoundingClientRect();
  return {
    nodeCount: nodes.length,
    allNodesInside: nodes.every((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.left >= bounds.left - 3 &&
        rect.right <= bounds.right + 3 &&
        rect.top >= bounds.top - 3 &&
        rect.bottom <= bounds.bottom + 3
      );
    }),
  };
});
await canvasMapPreview.getByRole("button", { name: "Fit map" }).click();
await canvas.page.waitForTimeout(80);
const mapSurfaceAfterSecondFit = await readMapElementState(canvasMapSurface);
const canvasMapFitPassed =
  mapElementMoved(mapSurfaceBeforeFit, mapSurfaceAfterFit, 2) &&
  canvasMapZoomBeforeFit !== null &&
  canvasMapZoomAfterFit !== null &&
  canvasMapZoomAfterFit <= canvasMapZoomBeforeFit &&
  canvasMapZoomAfterFit >= 40 &&
  canvasMapZoomAfterFit <= 120 &&
  canvasMapFitGeometry.nodeCount === canvasMapNodeCount &&
  canvasMapFitGeometry.allNodesInside &&
  mapElementStable(mapSurfaceAfterFit, mapSurfaceAfterSecondFit);
results.push({
  interaction: "canvas-mindmap-fit-map",
  passed: canvasMapFitPassed,
  zoomBefore: canvasMapZoomBeforeFit,
  zoomAfter: canvasMapZoomAfterFit,
  geometry: canvasMapFitGeometry,
  before: mapSurfaceBeforeFit,
  after: mapSurfaceAfterFit,
  secondFit: mapSurfaceAfterSecondFit,
});
if (!canvasMapFitPassed) {
  failures.push({
    interaction: "canvas-mindmap-fit-map",
    zoomBefore: canvasMapZoomBeforeFit,
    zoomAfter: canvasMapZoomAfterFit,
    geometry: canvasMapFitGeometry,
    before: mapSurfaceBeforeFit,
    after: mapSurfaceAfterFit,
    secondFit: mapSurfaceAfterSecondFit,
  });
}
await canvas.page.screenshot({
  path: path.join(outputDir, "canvas-mindmap-interactions-desktop-1440.png"),
  fullPage: false,
});

await canvas.page.locator("#workspace-mode-idea").click();
const canvasIdeaSource = `Create: Civic Repair Ledger
For: Residents, maintenance teams and local decision-makers
Problem: Small public-space failures are reported without a visible resolution path.
Change: Connect each observation to ownership, action and public learning.
Constraints: Privacy, accessibility and responsible evidence handling.
Evidence: A verified repair record and a clear next decision.`;
await canvas.page.locator("#workspace-text-editor").fill(canvasIdeaSource);
await canvas.page.waitForFunction(() =>
  document
    .querySelector("[aria-label='Local concept preview']")
    ?.textContent?.includes("Civic Repair Ledger"),
);
const canvasIdeaPreview = await canvas.page
  .locator("[aria-label='Local concept preview']")
  .textContent();
const canvasIdeaPassed =
  /Civic Repair Ledger/.test(canvasIdeaPreview ?? "") &&
  /Residents, maintenance teams and local decision-makers/.test(
    canvasIdeaPreview ?? "",
  ) &&
  /Connect each observation to ownership/.test(canvasIdeaPreview ?? "") &&
  canvasAgentRequests.length === 0;
results.push({
  interaction: "canvas-idea-local-preview",
  passed: canvasIdeaPassed,
  agentRequestCount: canvasAgentRequests.length,
  preview: canvasIdeaPreview?.replace(/\s+/g, " ").trim().slice(0, 420) ?? "",
});
if (!canvasIdeaPassed) {
  failures.push({
    interaction: "canvas-idea-local-preview",
    agentRequests: canvasAgentRequests,
    preview: canvasIdeaPreview?.replace(/\s+/g, " ").trim().slice(0, 420) ?? "",
  });
}

await canvas.page.locator("#workspace-mode-code").click();
const autoRun = canvas.page.getByLabel("Auto-run", { exact: true });
if (await autoRun.isChecked()) await autoRun.uncheck();
const canvasCodeMarker = "canvas-visual-verification-marker";
await canvas.page
  .locator("#workspace-code-editor")
  .fill(`<main id="${canvasCodeMarker}">Canvas code preview verified</main>`);
const canvasFrame = canvas.page.frameLocator("iframe[title='Live code preview']");
const markerBeforeRun = await canvasFrame.locator(`#${canvasCodeMarker}`).isVisible();
await canvas.page
  .locator("[aria-label='Creative input workbench']")
  .getByRole("button", { name: /^Run/ })
  .click();
await canvasFrame.locator(`#${canvasCodeMarker}`).waitFor({ state: "visible" });
const canvasCodeText = await canvasFrame
  .locator(`#${canvasCodeMarker}`)
  .textContent();
const canvasCodePassed =
  !markerBeforeRun &&
  canvasCodeText?.trim() === "Canvas code preview verified" &&
  canvasAgentRequests.length === 0;
results.push({
  interaction: "canvas-code-explicit-run",
  passed: canvasCodePassed,
  markerBeforeRun,
  renderedText: canvasCodeText,
  agentRequestCount: canvasAgentRequests.length,
});
if (!canvasCodePassed) {
  failures.push({
    interaction: "canvas-code-explicit-run",
    markerBeforeRun,
    renderedText: canvasCodeText,
    agentRequests: canvasAgentRequests,
  });
}
await canvas.page.screenshot({
  path: path.join(outputDir, "canvas-code-desktop-1440.png"),
  fullPage: false,
});

await canvas.page.getByRole("tab", { name: "Agent review" }).click();
const canvasAgentPanel = canvas.page.locator("#workspace-agent-panel");
const canvasAgentPanelText = await canvasAgentPanel.textContent();
const canvasAgentContextPassed =
  (await canvasAgentPanel.isVisible()) &&
  /Choose what the Agent can see/.test(canvasAgentPanelText ?? "") &&
  /Only the checked workspace context is sent/.test(canvasAgentPanelText ?? "") &&
  (await canvasAgentPanel.getByLabel("Current input", { exact: true }).isChecked()) &&
  !(await canvasAgentPanel.getByLabel("Preview console", { exact: true }).isChecked()) &&
  !(await canvasAgentPanel.getByLabel("Previous versions", { exact: true }).isChecked()) &&
  canvasAgentRequests.length === 0;
results.push({
  interaction: "canvas-agent-context-disclosure",
  passed: canvasAgentContextPassed,
  agentRequestCount: canvasAgentRequests.length,
});
if (!canvasAgentContextPassed) {
  failures.push({
    interaction: "canvas-agent-context-disclosure",
    agentRequests: canvasAgentRequests,
    panelText: canvasAgentPanelText?.replace(/\s+/g, " ").trim().slice(0, 520) ?? "",
  });
}
await canvas.page.screenshot({
  path: path.join(outputDir, "canvas-agent-context-desktop-1440.png"),
  fullPage: false,
});

const canvasLocationBeforeHandoff = canvas.page.url();
const handoffSessionBefore = await canvas.page.evaluate(() =>
  window.sessionStorage.getItem("kingxford:canvas-handoff:v1"),
);
const postCountBeforeHandoff = canvasPostRequests.length;
await canvas.page
  .getByRole("button", { name: "Build with Kingxford", exact: true })
  .click();
const canvasHandoff = canvas.page.getByRole("dialog", {
  name: "Take this from tested idea to production.",
});
await canvasHandoff.waitFor({ state: "visible" });
const entrepreneurshipControl = canvasHandoff.getByRole("button", {
  name: /Continue in AI-driven Entrepreneurship Platform/,
});
const handoffSessionAfter = await canvas.page.evaluate(() =>
  window.sessionStorage.getItem("kingxford:canvas-handoff:v1"),
);
const canvasHandoffState = {
  dialogVisible: await canvasHandoff.isVisible(),
  currentVersionIncluded: await canvasHandoff
    .getByLabel("Current version", { exact: true })
    .isChecked(),
  entrepreneurshipDisabled: await entrepreneurshipControl.isDisabled(),
  entrepreneurshipTag: await entrepreneurshipControl.evaluate(
    (element) => element.tagName,
  ),
  entrepreneurshipTitle: await entrepreneurshipControl.getAttribute("title"),
  locationUnchanged: canvas.page.url() === canvasLocationBeforeHandoff,
  sessionUntouched:
    handoffSessionBefore === null && handoffSessionAfter === null,
  postRequestsAfterOpen:
    canvasPostRequests.length - postCountBeforeHandoff,
};
const canvasHandoffPassed =
  canvasHandoffState.dialogVisible &&
  canvasHandoffState.currentVersionIncluded &&
  canvasHandoffState.entrepreneurshipDisabled &&
  canvasHandoffState.entrepreneurshipTag === "BUTTON" &&
  /not available yet/i.test(canvasHandoffState.entrepreneurshipTitle ?? "") &&
  canvasHandoffState.locationUnchanged &&
  canvasHandoffState.sessionUntouched &&
  canvasHandoffState.postRequestsAfterOpen === 0;
results.push({
  interaction: "canvas-build-handoff-safe-open",
  passed: canvasHandoffPassed,
  ...canvasHandoffState,
});
if (!canvasHandoffPassed) {
  failures.push({
    interaction: "canvas-build-handoff-safe-open",
    ...canvasHandoffState,
  });
}
await canvas.page.screenshot({
  path: path.join(outputDir, "canvas-handoff-desktop-1440.png"),
  fullPage: false,
});

const postCountBeforeTransfer = canvasPostRequests.length;
await Promise.all([
  canvas.page.waitForURL("**/contact?brief=workspace"),
  canvasHandoff
    .getByRole("button", { name: "Request a scoped build plan" })
    .click(),
]);
await canvas.page.locator("[data-state='ready']").waitFor({ state: "visible" });
const contactHandoffState = await canvas.page.evaluate(() => ({
  url: window.location.pathname + window.location.search,
  notice: document.querySelector("[data-state='ready']")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  problem: document.querySelector("form textarea")?.value ?? "",
  sessionPackage: Boolean(
    window.sessionStorage.getItem("kingxford:canvas-handoff:v1"),
  ),
}));
const contactHandoffPassed =
  contactHandoffState.url === "/contact?brief=workspace" &&
  /Canvas handoff ready/i.test(contactHandoffState.notice) &&
  /Canvas code preview verified/.test(contactHandoffState.problem) &&
  contactHandoffState.sessionPackage &&
  canvasPostRequests.length === postCountBeforeTransfer;
results.push({
  interaction: "canvas-contact-handoff-prefill",
  passed: contactHandoffPassed,
  ...contactHandoffState,
  postRequestsAfterTransfer: canvasPostRequests.length - postCountBeforeTransfer,
});
if (!contactHandoffPassed) {
  failures.push({
    interaction: "canvas-contact-handoff-prefill",
    ...contactHandoffState,
    postRequestsAfterTransfer: canvasPostRequests.length - postCountBeforeTransfer,
  });
}
await canvas.page.screenshot({
  path: path.join(outputDir, "canvas-contact-handoff-desktop-1440.png"),
  fullPage: false,
});
await canvas.context.close();

const createGallery = await inspectPage(
  "create-gallery-desktop-1440",
  "/create",
  { width: 1440, height: 1000 },
  { scrollSelector: "[data-prototype-gallery]" },
);
await createGallery.context.close();

for (const expected of expectedCreateShowcases) {
  const detail = await inspectPage(
    `create-${expected.slug}-1440`,
    `/create/${expected.slug}`,
    { width: 1440, height: 1000 },
  );
  const detailState = await detail.page.evaluate(({ slug }) => {
    const disclosure = document.querySelector(
      "aside[aria-label='Concept disclosure']",
    );
    const navLinks = [
      ...document.querySelectorAll(".site-header__nav-link[href='/create']"),
    ];
    const schemaNode = document.querySelector(`#showcase-schema-${slug}`);
    const breadcrumbsNode = document.querySelector(
      `#showcase-breadcrumbs-${slug}`,
    );
    let schema = null;
    let breadcrumbs = null;
    try {
      schema = schemaNode?.textContent
        ? JSON.parse(schemaNode.textContent)
        : null;
      breadcrumbs = breadcrumbsNode?.textContent
        ? JSON.parse(breadcrumbsNode.textContent)
        : null;
    } catch {
      schema = null;
      breadcrumbs = null;
    }

    return {
      rootSector:
        document
          .querySelector("[data-showcase-sector]")
          ?.getAttribute("data-showcase-sector") ?? null,
      heading: document.querySelector("main h1")?.textContent?.trim() ?? "",
      currentNav:
        navLinks.length > 0 &&
        navLinks.every((link) => link.getAttribute("aria-current") === "page"),
      disclosurePresent: Boolean(disclosure),
      disclosureText: disclosure?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      schemaType: schema?.["@type"] ?? null,
      schemaUsageInfo: schema?.usageInfo ?? "",
      breadcrumbType: breadcrumbs?.["@type"] ?? null,
      breadcrumbCount: Array.isArray(breadcrumbs?.itemListElement)
        ? breadcrumbs.itemListElement.length
        : 0,
    };
  }, expected);
  let detailInteraction = { passed: false, state: "not-tested" };
  if (expected.sector === "science") {
    await detail.page.locator("#sample-tab-LV-SYN-021").click();
    const selectedRecord = await detail.page
      .locator("#sample-panel-LV-SYN-021")
      .textContent();
    await detail.page
      .locator("#lineage button")
      .filter({ hasText: "Review" })
      .click();
    const lineageState = await detail.page.locator("#lineage").textContent();
    detailInteraction = {
      passed:
        /Polymer film control/i.test(selectedRecord ?? "") &&
        /alternative explanations/i.test(lineageState ?? "") &&
        /Independent reviewer/i.test(lineageState ?? ""),
      state: selectedRecord?.replace(/\s+/g, " ").trim() ?? "",
    };
  } else if (expected.sector === "finance") {
    await detail.page
      .locator("#finance-scenario label:has(input[value='pressure'])")
      .click();
    await detail.page
      .locator("#finance-governance label")
      .filter({ hasText: "Conflicts declared" })
      .click();
    const scenarioSelected = await detail.page
      .locator("#finance-scenario input[type='radio'][value='pressure']")
      .isChecked();
    const governanceText = await detail.page
      .locator("#finance-governance")
      .textContent();
    detailInteraction = {
      passed:
        scenarioSelected &&
        /Ready for fictional review/i.test(governanceText ?? "") &&
        /not an approval/i.test(governanceText ?? ""),
      state: governanceText?.replace(/\s+/g, " ").trim().slice(0, 280) ?? "",
    };
  } else {
    await detail.page
      .getByRole("button", { name: /Materials in circulation/i })
      .first()
      .click();
    await detail.page
      .locator("#curriculum-composer")
      .getByRole("button", { name: "Open Build phase" })
      .click();
    const pathwayText = await detail.page
      .locator("#curriculum-composer [aria-live='polite']")
      .textContent();
    detailInteraction = {
      passed:
        /How can everyday materials circulate/i.test(pathwayText ?? "") &&
        /Working proposition/i.test(pathwayText ?? ""),
      state: pathwayText?.replace(/\s+/g, " ").trim() ?? "",
    };
  }

  const detailPassed =
    detailState.rootSector === expected.sector &&
    detailState.heading === expected.heading &&
    detailState.currentNav &&
    detailState.disclosurePresent &&
    /fictional/i.test(detailState.disclosureText) &&
    /demonstration/i.test(detailState.disclosureText) &&
    detailState.schemaType === "CreativeWork" &&
    /fictional/i.test(detailState.schemaUsageInfo) &&
    detailState.breadcrumbType === "BreadcrumbList" &&
    detailState.breadcrumbCount === 2 &&
    detailInteraction.passed;
  results.push({
    interaction: `create-detail-${expected.slug}`,
    passed: detailPassed,
    detailInteraction,
    ...detailState,
  });
  if (!detailPassed) {
    failures.push({
      interaction: `create-detail-${expected.slug}`,
      detailInteraction,
      ...detailState,
    });
  }
  await detail.context.close();

  const detailMobile = await inspectPage(
    `create-${expected.slug}-mobile-390`,
    `/create/${expected.slug}`,
    { width: 390, height: 844 },
  );
  await detailMobile.context.close();
}

const createHeader = await inspectPage(
  "create-header-1201",
  "/create",
  { width: 1201, height: 900 },
);
const createHeaderState = await createHeader.page.evaluate(() => {
  const brand = document.querySelector(".site-header__brand");
  const nav = document.querySelector(".site-header__desktop-nav");
  const actions = document.querySelector(".site-header__actions");
  if (!brand || !nav || !actions) {
    return {
      elementsPresent: false,
      navDisplay: null,
      navLinkCount: 0,
      currentNav: false,
      brandNavOverlap: null,
      navActionsOverlap: null,
    };
  }
  const brandRect = brand.getBoundingClientRect();
  const navRect = nav.getBoundingClientRect();
  const actionsRect = actions.getBoundingClientRect();
  return {
    elementsPresent: true,
    navDisplay: getComputedStyle(nav).display,
    navLinkCount: nav.querySelectorAll(".site-header__nav-link").length,
    currentNav:
      nav
        .querySelector(".site-header__nav-link[href='/create']")
        ?.getAttribute("aria-current") === "page",
    brandNavOverlap: Math.max(0, brandRect.right - navRect.left),
    navActionsOverlap: Math.max(0, navRect.right - actionsRect.left),
  };
});
const createHeaderPassed =
  createHeaderState.elementsPresent &&
  createHeaderState.navDisplay !== "none" &&
  createHeaderState.navLinkCount >= 7 &&
  createHeaderState.currentNav &&
  createHeaderState.brandNavOverlap <= 0.5 &&
  createHeaderState.navActionsOverlap <= 0.5;
results.push({
  interaction: "create-header-overlap-1201",
  passed: createHeaderPassed,
  ...createHeaderState,
});
if (!createHeaderPassed) {
  failures.push({
    interaction: "create-header-overlap-1201",
    ...createHeaderState,
  });
}
await createHeader.context.close();

const unknownCreate = await inspectPage(
  "create-unknown-404",
  "/create/not-a-real-showcase",
  { width: 1024, height: 900 },
  { expectedStatus: 404 },
);
const unknownCreateState = await unknownCreate.page.evaluate(() => ({
  heading: document.querySelector("main h1")?.textContent?.trim() ?? "",
  notFoundSignal: document.body.innerText.includes("404"),
}));
const unknownCreatePassed =
  unknownCreate.record.status === 404 &&
  unknownCreateState.notFoundSignal &&
  unknownCreateState.heading.length > 0;
results.push({
  interaction: "create-unknown-slug-404",
  passed: unknownCreatePassed,
  ...unknownCreateState,
});
if (!unknownCreatePassed) {
  failures.push({
    interaction: "create-unknown-slug-404",
    status: unknownCreate.record.status,
    ...unknownCreateState,
  });
}
await unknownCreate.context.close();

const media = await inspectPage(
  "media-desktop-1440",
  "/media",
  { width: 1440, height: 1000 },
);
await media.page.locator(".media-card__image").first().scrollIntoViewIfNeeded();
await media.page.waitForFunction(() => {
  const cover = document.querySelector(".media-card__image");
  return (
    cover instanceof HTMLImageElement &&
    cover.complete &&
    cover.naturalWidth > 0
  );
});
const mediaIndexState = await media.page.evaluate(() => {
  const cover = document.querySelector(".media-card__image");
  return {
    cardCount: document.querySelectorAll(".media-card").length,
    currentNav:
      document
        .querySelector(".site-header__nav-link[href='/media']")
        ?.getAttribute("aria-current") === "page",
    coverReady:
      cover instanceof HTMLImageElement &&
      cover.complete &&
      cover.naturalWidth > 0,
  };
});
const mediaIndexPassed =
  mediaIndexState.cardCount >= 1 &&
  mediaIndexState.currentNav &&
  mediaIndexState.coverReady;
results.push({
  interaction: "media-index",
  passed: mediaIndexPassed,
  ...mediaIndexState,
});
if (!mediaIndexPassed) {
  failures.push({ interaction: "media-index", ...mediaIndexState });
}
await media.context.close();

const mediaArticle = await inspectPage(
  "media-article-desktop-1440",
  "/media/how-to-get-ahead-in-the-ai-era",
  { width: 1440, height: 1000 },
);
const mediaArticleState = await mediaArticle.page.evaluate(() => {
  const cover = document.querySelector(".media-article__cover img");
  return {
    title: document.querySelector("h1")?.textContent?.trim() ?? "",
    sectionCount: document.querySelectorAll(
      ".media-article__body > section",
    ).length,
    coverReady:
      cover instanceof HTMLImageElement &&
      cover.complete &&
      cover.naturalWidth > 0,
    articleTextLength:
      document.querySelector(".media-article__body")?.textContent?.trim()
        .length ?? 0,
    audioCount: document.querySelectorAll("audio").length,
    articleSchema: Boolean(
      document.querySelector("script[type='application/ld+json']"),
    ),
  };
});
const mediaArticlePassed =
  mediaArticleState.title === "How to Get Ahead in the AI Era" &&
  mediaArticleState.sectionCount >= 7 &&
  mediaArticleState.coverReady &&
  mediaArticleState.articleTextLength > 7000 &&
  mediaArticleState.audioCount === 0 &&
  mediaArticleState.articleSchema;
results.push({
  interaction: "media-article",
  passed: mediaArticlePassed,
  ...mediaArticleState,
});
if (!mediaArticlePassed) {
  failures.push({ interaction: "media-article", ...mediaArticleState });
}
await mediaArticle.context.close();

const abundanceArticle = await inspectPage(
  "sustainable-abundance-desktop-1440",
  "/media/sustainable-abundance-for-all",
  { width: 1440, height: 1000 },
);
const abundanceArticleState = await abundanceArticle.page.evaluate(() => {
  const cover = document.querySelector(".media-article__cover img");
  const evidence = document.querySelector("#evidence-dashboard");
  const rows = document.querySelectorAll("#evidence-register tbody tr");
  const charts = document.querySelectorAll("#capacity-engine figure");
  const sourceNotes = document.querySelectorAll(".media-sources li");
  return {
    title: document.querySelector("h1")?.textContent?.trim() ?? "",
    coverReady:
      cover instanceof HTMLImageElement &&
      cover.complete &&
      cover.naturalWidth > 0,
    evidenceDashboard: Boolean(evidence),
    evidenceRows: rows.length,
    chartCount: charts.length,
    sourceCount: sourceNotes.length,
    audioCount: document.querySelectorAll("audio").length,
    evidenceTextLength: evidence?.textContent?.trim().length ?? 0,
  };
});
const abundanceArticlePassed =
  abundanceArticleState.title.startsWith("Sustainable Abundance for All") &&
  abundanceArticleState.coverReady &&
  abundanceArticleState.evidenceDashboard &&
  abundanceArticleState.evidenceRows === 8 &&
  abundanceArticleState.chartCount === 3 &&
  abundanceArticleState.sourceCount === 8 &&
  abundanceArticleState.audioCount === 0 &&
  abundanceArticleState.evidenceTextLength > 1500;
results.push({
  interaction: "sustainable-abundance-evidence",
  passed: abundanceArticlePassed,
  ...abundanceArticleState,
});
if (!abundanceArticlePassed) {
  failures.push({
    interaction: "sustainable-abundance-evidence",
    ...abundanceArticleState,
  });
}
await abundanceArticle.page
  .locator("#evidence-dashboard")
  .scrollIntoViewIfNeeded();
await abundanceArticle.page.waitForTimeout(250);
await abundanceArticle.page.screenshot({
  path: path.join(outputDir, "sustainable-abundance-evidence.png"),
  fullPage: false,
});
await abundanceArticle.context.close();

const light = await inspectPage(
  "home-light-1024",
  "/",
  { width: 1024, height: 900 },
  { colorScheme: "light" },
);
await light.context.close();

const mobile = await inspectPage(
  "home-mobile-390",
  "/",
  { width: 390, height: 844 },
);
const menuSummary = mobile.page.locator(".site-header__mobile-summary");
await menuSummary.click();
const mobileMenuOpen = await mobile.page
  .locator(".site-header__mobile-menu[open]")
  .isVisible();
results.push({ interaction: "mobile-menu", passed: mobileMenuOpen });
if (!mobileMenuOpen) failures.push({ interaction: "mobile-menu" });
const mobileCommandVisible = await mobile.page
  .getByRole("button", { name: "Open site command menu" })
  .isVisible();
results.push({
  interaction: "mobile-command-access",
  passed: mobileCommandVisible,
});
if (!mobileCommandVisible) {
  failures.push({ interaction: "mobile-command-access" });
}
const selectedMobileTheme = mobile.page.locator(
  ".site-header__mobile-theme [role='radio'][aria-checked='true']",
);
await selectedMobileTheme.focus();
await mobile.page.keyboard.press("ArrowLeft");
const mobileThemeKeyboard = await mobile.page
  .locator(".site-header__mobile-theme [role='radio'][aria-checked='true']")
  .evaluate((element) => element === document.activeElement);
results.push({
  interaction: "mobile-theme-access",
  passed: mobileThemeKeyboard,
});
if (!mobileThemeKeyboard) {
  failures.push({ interaction: "mobile-theme-access" });
}
await mobile.page.screenshot({
  path: path.join(outputDir, "home-mobile-menu.png"),
  fullPage: false,
});
await menuSummary.click();
await mobile.page.addStyleTag({
  content: "html, body { scroll-behavior: auto !important; }",
});
const mobileStoryMetrics = await mobile.page
  .locator(".kx-cinematic")
  .evaluate((story) => {
    const rect = story.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });
await mobile.page.evaluate(
  ({ top, height, viewportHeight }) => {
    window.scrollTo({
      top: top + (height - viewportHeight) * 0.34,
      behavior: "auto",
    });
  },
  mobileStoryMetrics,
);
await mobile.page.waitForTimeout(180);
await mobile.page.screenshot({
  path: path.join(outputDir, "kingxford-mobile-studio.png"),
  fullPage: false,
});
await mobile.context.close();

const mobileWork = await inspectPage(
  "work-mobile-390",
  "/work",
  { width: 390, height: 844 },
);
await mobileWork.context.close();

const mobileCreate = await inspectPage(
  "create-mobile-390",
  "/create",
  { width: 390, height: 844 },
);
await mobileCreate.page.locator(".site-header__mobile-summary").click();
const mobileCreateState = {
  menuOpen: await mobileCreate.page
    .locator(".site-header__mobile-menu[open]")
    .isVisible(),
  currentNavVisible: await mobileCreate.page
    .locator(
      ".site-header__mobile-panel .site-header__nav-link[href='/create'][aria-current='page']",
    )
    .isVisible(),
  featuredCount: await mobileCreate.page
    .locator("[data-prototype-gallery] [role='tab']")
    .count(),
  heading: await mobileCreate.page
    .locator("#create-heading")
    .textContent(),
};
const mobileCreatePassed =
  mobileCreateState.menuOpen &&
  mobileCreateState.currentNavVisible &&
  mobileCreateState.featuredCount === 3 &&
  mobileCreateState.heading?.trim() === "What should exist next?";
results.push({
  interaction: "create-mobile-index",
  passed: mobileCreatePassed,
  ...mobileCreateState,
});
if (!mobileCreatePassed) {
  failures.push({ interaction: "create-mobile-index", ...mobileCreateState });
}
await mobileCreate.page.screenshot({
  path: path.join(outputDir, "create-mobile-menu.png"),
  fullPage: false,
});
await mobileCreate.context.close();

const mobileCanvas = await inspectPage(
  "canvas-mobile-390",
  "/create/workspace",
  { width: 390, height: 844 },
  { hasTouch: true, isMobile: true },
);
const mobileCanvasTabs = mobileCanvas.page.locator(
  "[aria-label='Mobile workspace panes']",
);
const mobileCanvasInputTab = mobileCanvasTabs.getByRole("button", {
  name: "Input",
  exact: true,
});
const mobileCanvasPreviewTab = mobileCanvasTabs.getByRole("button", {
  name: "Preview",
  exact: true,
});
const mobileCanvasAgentTab = mobileCanvasTabs.getByRole("button", {
  name: "Agent",
  exact: true,
});
const mobileWorkbench = mobileCanvas.page.locator(
  "[aria-label='Creative input workbench']",
);
const mobileResultPane = mobileCanvas.page.locator(
  "[aria-label='Live result and agent review']",
);
const mobilePreviewPanel = mobileCanvas.page.locator(
  "#workspace-preview-panel",
);
const mobileAgentPanel = mobileCanvas.page.locator("#workspace-agent-panel");

const mobileCanvasInputState = {
  pane: await mobileCanvas.page.locator("main[data-mobile-pane]").getAttribute("data-mobile-pane"),
  selected: (await mobileCanvasInputTab.getAttribute("aria-pressed")) === "true",
  workbenchVisible: await mobileWorkbench.isVisible(),
  resultHidden: !(await mobileResultPane.isVisible()),
};

await mobileCanvasPreviewTab.click();
await mobilePreviewPanel.waitFor({ state: "visible" });
const mobileCanvasPreviewState = {
  pane: await mobileCanvas.page.locator("main[data-mobile-pane]").getAttribute("data-mobile-pane"),
  selected: (await mobileCanvasPreviewTab.getAttribute("aria-pressed")) === "true",
  workbenchHidden: !(await mobileWorkbench.isVisible()),
  resultVisible: await mobileResultPane.isVisible(),
  previewVisible: await mobilePreviewPanel.isVisible(),
  agentHidden: !(await mobileAgentPanel.isVisible()),
  conceptVisible: await mobilePreviewPanel
    .locator("[aria-label='Local concept preview']")
    .isVisible(),
};
await mobileCanvas.page.screenshot({
  path: path.join(outputDir, "canvas-mobile-preview-390.png"),
  fullPage: false,
});

await mobileCanvasAgentTab.click();
await mobileAgentPanel.waitFor({ state: "visible" });
const mobileAgentText = await mobileAgentPanel.textContent();
const mobileCanvasAgentState = {
  pane: await mobileCanvas.page.locator("main[data-mobile-pane]").getAttribute("data-mobile-pane"),
  selected: (await mobileCanvasAgentTab.getAttribute("aria-pressed")) === "true",
  workbenchHidden: !(await mobileWorkbench.isVisible()),
  resultVisible: await mobileResultPane.isVisible(),
  previewHidden: !(await mobilePreviewPanel.isVisible()),
  agentVisible: await mobileAgentPanel.isVisible(),
  contextDisclosureVisible:
    /Choose what the Agent can see/.test(mobileAgentText ?? "") &&
    /Only the checked workspace context is sent/.test(mobileAgentText ?? ""),
};
await mobileCanvas.page.screenshot({
  path: path.join(outputDir, "canvas-mobile-agent-390.png"),
  fullPage: false,
});

await mobileCanvasInputTab.click();
await mobileWorkbench.waitFor({ state: "visible" });
const mobileCanvasReturnState = {
  pane: await mobileCanvas.page.locator("main[data-mobile-pane]").getAttribute("data-mobile-pane"),
  selected: (await mobileCanvasInputTab.getAttribute("aria-pressed")) === "true",
  workbenchVisible: await mobileWorkbench.isVisible(),
  resultHidden: !(await mobileResultPane.isVisible()),
};

const mobileCanvasPassed =
  mobileCanvasInputState.pane === "input" &&
  mobileCanvasInputState.selected &&
  mobileCanvasInputState.workbenchVisible &&
  mobileCanvasInputState.resultHidden &&
  mobileCanvasPreviewState.pane === "preview" &&
  mobileCanvasPreviewState.selected &&
  mobileCanvasPreviewState.workbenchHidden &&
  mobileCanvasPreviewState.resultVisible &&
  mobileCanvasPreviewState.previewVisible &&
  mobileCanvasPreviewState.agentHidden &&
  mobileCanvasPreviewState.conceptVisible &&
  mobileCanvasAgentState.pane === "agent" &&
  mobileCanvasAgentState.selected &&
  mobileCanvasAgentState.workbenchHidden &&
  mobileCanvasAgentState.resultVisible &&
  mobileCanvasAgentState.previewHidden &&
  mobileCanvasAgentState.agentVisible &&
  mobileCanvasAgentState.contextDisclosureVisible &&
  mobileCanvasReturnState.pane === "input" &&
  mobileCanvasReturnState.selected &&
  mobileCanvasReturnState.workbenchVisible &&
  mobileCanvasReturnState.resultHidden;
results.push({
  interaction: "canvas-mobile-pane-navigation",
  passed: mobileCanvasPassed,
  input: mobileCanvasInputState,
  preview: mobileCanvasPreviewState,
  agent: mobileCanvasAgentState,
  returnedInput: mobileCanvasReturnState,
});
if (!mobileCanvasPassed) {
  failures.push({
    interaction: "canvas-mobile-pane-navigation",
    input: mobileCanvasInputState,
    preview: mobileCanvasPreviewState,
    agent: mobileCanvasAgentState,
    returnedInput: mobileCanvasReturnState,
  });
}

await mobileCanvas.page.locator("#workspace-mode-mindmap").click();
await mobileCanvasPreviewTab.click();
const mobileMapPreview = mobileCanvas.page.locator(
  "[aria-label='Mind map preview']",
);
const mobileMapViewport = mobileMapPreview.locator("[data-map-viewport]");
const mobileMapSurface = mobileMapPreview.locator("[data-map-canvas]");
const mobileMapNodes = mobileMapPreview.locator("[data-map-node-id]");
await mobileMapViewport.waitFor({ state: "visible" });
await mobileMapViewport.scrollIntoViewIfNeeded();
const mobileTouchCapability = await mobileCanvas.page.evaluate(() => ({
  maxTouchPoints: navigator.maxTouchPoints,
  coarsePointer: matchMedia("(pointer: coarse)").matches,
}));
const mobileMapCdp = await mobileCanvas.context.newCDPSession(
  mobileCanvas.page,
);
const mobileMapBackgroundPoint = await findMapBackgroundPoint(
  mobileMapViewport,
);
const mobileMapSurfaceBeforeTouch = await readMapElementState(
  mobileMapSurface,
);
const mobileScrollBeforeTouch = await mobileCanvas.page.evaluate(
  () => window.scrollY,
);
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [
    {
      x: mobileMapBackgroundPoint.x,
      y: mobileMapBackgroundPoint.y,
      radiusX: 3,
      radiusY: 3,
      force: 1,
      id: 1,
    },
  ],
});
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [
    {
      x: mobileMapBackgroundPoint.x + mobileMapBackgroundPoint.dx,
      y: mobileMapBackgroundPoint.y + mobileMapBackgroundPoint.dy,
      radiusX: 3,
      radiusY: 3,
      force: 1,
      id: 1,
    },
  ],
});
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await mobileCanvas.page.waitForTimeout(220);
const mobileMapSurfaceAfterTouch = await readMapElementState(
  mobileMapSurface,
);
const mobileScrollAfterTouch = await mobileCanvas.page.evaluate(
  () => window.scrollY,
);
const mobileMapTouchPanPassed =
  mobileTouchCapability.maxTouchPoints > 0 &&
  mapElementMoved(
    mobileMapSurfaceBeforeTouch,
    mobileMapSurfaceAfterTouch,
    10,
  ) &&
  Math.abs(mobileScrollAfterTouch - mobileScrollBeforeTouch) <= 2;
results.push({
  interaction: "canvas-mindmap-touch-background-pan-390",
  passed: mobileMapTouchPanPassed,
  capability: mobileTouchCapability,
  hitTarget: mobileMapBackgroundPoint,
  scrollBefore: mobileScrollBeforeTouch,
  scrollAfter: mobileScrollAfterTouch,
  canvasBefore: mobileMapSurfaceBeforeTouch,
  canvasAfter: mobileMapSurfaceAfterTouch,
});
if (!mobileMapTouchPanPassed) {
  failures.push({
    interaction: "canvas-mindmap-touch-background-pan-390",
    capability: mobileTouchCapability,
    hitTarget: mobileMapBackgroundPoint,
    scrollBefore: mobileScrollBeforeTouch,
    scrollAfter: mobileScrollAfterTouch,
    canvasBefore: mobileMapSurfaceBeforeTouch,
    canvasAfter: mobileMapSurfaceAfterTouch,
  });
}

const mobileNodeTouchTarget = await findHittableMapNodePoint(mobileMapNodes);
if (!mobileNodeTouchTarget) {
  throw new Error(
    "No touch-draggable mind-map node is unobscured at the current mobile viewport.",
  );
}
const mobileMapFirstNode = mobileMapNodes.nth(mobileNodeTouchTarget.index);
const mobileMapNodeBeforeTouch = await readMapElementState(
  mobileMapFirstNode,
);
const mobileMapSurfaceBeforeNodeTouch = await readMapElementState(
  mobileMapSurface,
);
const mobileNodeTouchStart = {
  x: mobileNodeTouchTarget.x,
  y: mobileNodeTouchTarget.y,
};
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [
    {
      ...mobileNodeTouchStart,
      radiusX: 3,
      radiusY: 3,
      force: 1,
      id: 2,
    },
  ],
});
await mobileCanvas.page.waitForTimeout(24);
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [
    {
      x: mobileNodeTouchStart.x + 17,
      y: mobileNodeTouchStart.y - 12,
      radiusX: 3,
      radiusY: 3,
      force: 1,
      id: 2,
    },
  ],
});
await mobileCanvas.page.waitForTimeout(24);
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [
    {
      x: mobileNodeTouchStart.x + 34,
      y: mobileNodeTouchStart.y - 24,
      radiusX: 3,
      radiusY: 3,
      force: 1,
      id: 2,
    },
  ],
});
await mobileCanvas.page.waitForTimeout(24);
await mobileMapCdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await mobileCanvas.page.waitForTimeout(100);
const mobileMapNodeAfterTouch = await readMapElementState(
  mobileMapFirstNode,
);
const mobileMapSurfaceAfterNodeTouch = await readMapElementState(
  mobileMapSurface,
);
const mobileMapNodeTouchPassed =
  mobileTouchCapability.maxTouchPoints > 0 &&
  mapElementMoved(mobileMapNodeBeforeTouch, mobileMapNodeAfterTouch, 10) &&
  mapElementStable(
    mobileMapSurfaceBeforeNodeTouch,
    mobileMapSurfaceAfterNodeTouch,
  );
results.push({
  interaction: "canvas-mindmap-touch-node-drag-390",
  passed: mobileMapNodeTouchPassed,
  capability: mobileTouchCapability,
  nodeHitTarget: mobileNodeTouchTarget,
  nodeBefore: mobileMapNodeBeforeTouch,
  nodeAfter: mobileMapNodeAfterTouch,
  canvasBeforeNode: mobileMapSurfaceBeforeNodeTouch,
  canvasAfterNode: mobileMapSurfaceAfterNodeTouch,
});
if (!mobileMapNodeTouchPassed) {
  failures.push({
    interaction: "canvas-mindmap-touch-node-drag-390",
    capability: mobileTouchCapability,
    nodeHitTarget: mobileNodeTouchTarget,
    nodeBefore: mobileMapNodeBeforeTouch,
    nodeAfter: mobileMapNodeAfterTouch,
    canvasBeforeNode: mobileMapSurfaceBeforeNodeTouch,
    canvasAfterNode: mobileMapSurfaceAfterNodeTouch,
  });
}
await mobileMapPreview
  .getByRole("button", { name: "Reset map layout" })
  .click();
await mobileMapPreview.getByRole("button", { name: "Fit map" }).click();
await mobileCanvas.page.screenshot({
  path: path.join(outputDir, "canvas-mindmap-touch-mobile-390.png"),
  fullPage: false,
});
await mobileCanvas.context.close();

const mobileMedia = await inspectPage(
  "media-mobile-390",
  "/media",
  { width: 390, height: 844 },
);
await mobileMedia.context.close();

const mobileMediaArticle = await inspectPage(
  "media-article-mobile-390",
  "/media/how-to-get-ahead-in-the-ai-era",
  { width: 390, height: 844 },
);
await mobileMediaArticle.context.close();

const mobileAbundanceArticle = await inspectPage(
  "sustainable-abundance-mobile-390",
  "/media/sustainable-abundance-for-all",
  { width: 390, height: 844 },
);
await mobileAbundanceArticle.page
  .locator("#evidence-dashboard")
  .scrollIntoViewIfNeeded();
await mobileAbundanceArticle.page.waitForTimeout(250);
await mobileAbundanceArticle.page.screenshot({
  path: path.join(outputDir, "sustainable-abundance-evidence-mobile.png"),
  fullPage: false,
});
await mobileAbundanceArticle.context.close();

const project = await inspectPage(
  "project-veridanth-1440",
  "/work/veridanth",
  { width: 1440, height: 1000 },
);
await project.context.close();

const reduced = await inspectPage(
  "home-reduced-motion",
  "/",
  { width: 1024, height: 900 },
  { reducedMotion: "reduce" },
);
const reducedMotionMatches = await reduced.page.evaluate(() =>
  matchMedia("(prefers-reduced-motion: reduce)").matches,
);
results.push({
  interaction: "reduced-motion-emulation",
  passed: reducedMotionMatches,
});
if (!reducedMotionMatches) {
  failures.push({ interaction: "reduced-motion-emulation" });
}
await reduced.page.waitForTimeout(500);
const reducedStory = await reduced.page.locator(".kx-static").evaluate((story) => {
  return {
    sourceCount: story.querySelectorAll("video source").length,
    chapterCount: story.querySelectorAll(".kx-static__chapter").length,
    heroVisible: Boolean(story.querySelector(".kx-static__hero")),
  };
});
const reducedStoryPassed =
  reducedStory.sourceCount === 0 &&
  reducedStory.heroVisible &&
  reducedStory.chapterCount === 5;
results.push({
  interaction: "kingxford-reduced-motion-fallback",
  passed: reducedStoryPassed,
  ...reducedStory,
});
if (!reducedStoryPassed) {
  failures.push({
    interaction: "kingxford-reduced-motion-fallback",
    ...reducedStory,
  });
}
await reduced.context.close();

await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  passed: failures.length === 0,
  failures,
  results,
};

await fs.writeFile(
  path.join(outputDir, "visual-verification.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exit(1);
