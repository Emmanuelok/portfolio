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

const expectedPrimaryDestinations = [
  { label: "Mission", href: "/" },
  { label: "Work", href: "/work" },
  { label: "Lab", href: "/lab" },
  { label: "Field notes", href: "/media" },
  { label: "Create", href: "/create" },
];

function localExpectedConsoleState(message) {
  if (message.type() !== "error") return null;
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(base.hostname)) {
    return null;
  }

  const observabilityPaths = [
    "/_vercel/insights/script.js",
    "/_vercel/speed-insights/script.js",
  ];
  const locationUrl = message.location().url;
  try {
    const location = new URL(locationUrl || base.origin, base);
    if (
      location.origin === base.origin &&
      observabilityPaths.includes(location.pathname) &&
      message.text() ===
        "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ) {
      return { kind: "local-observability-404", path: location.pathname };
    }
  } catch {
    // The exact message form below remains independently verifiable.
  }

  if (
    /^Refused to execute script from '.+' because its MIME type \('text\/plain'\) is not executable, and strict MIME type checking is enabled\.$/.test(
      message.text(),
    )
  ) {
    const pathname = observabilityPaths.find((candidate) =>
      message.text().includes(`${base.origin}${candidate}`),
    );
    if (pathname) {
      return { kind: "local-observability-mime", path: pathname };
    }
  }

  if (
    message.text() ===
      "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
  ) {
    try {
      const location = new URL(locationUrl, base);
      if (
        location.origin === base.origin &&
        (location.pathname === "/api/cloud/account" ||
          location.pathname === "/api/cloud/organization" ||
          /^\/api\/cloud\/projects\/kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}\/evidence$/.test(
            location.pathname,
          ))
      ) {
        return { kind: "unconfigured-cloud-503", path: location.pathname };
      }
    } catch {
      return null;
    }
  }
  return null;
}

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
  const expectedConsoleStates = [];
  const pageErrors = [];

  page.on("console", (message) => {
    const expectedNotFoundConsole =
      options.expectedStatus === 404 &&
      message.type() === "error" &&
      /failed to load resource.*404/i.test(message.text());
    const expectedLocalState = localExpectedConsoleState(message);
    if (expectedLocalState) {
      expectedConsoleStates.push({
        ...expectedLocalState,
        text: message.text(),
      });
      return;
    }
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
    expectedConsoleStates,
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

const homeNexusState = await desktop.page.evaluate((expectedDestinations) => {
  const nexusTitle = document.querySelector("#platform-nexus-title");
  const nexus = nexusTitle?.closest("section");
  const projectInput = document.querySelector("#platform-project-start");
  const privacy = nexus
    ? [...nexus.querySelectorAll("p")].find((element) =>
        /This text is stored only in this browser tab when Canvas opens/.test(
          element.textContent ?? "",
        ),
      )
    : null;
  const firstScreen = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight + 1 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  };
  const elementGeometry = (element) => {
    if (!(element instanceof HTMLElement)) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: Math.round(rect.top * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      viewportHeight: window.innerHeight,
    };
  };
  const destinationLinks = [
    ...document.querySelectorAll(
      ".site-header__desktop-nav .site-header__nav-link",
    ),
  ].map((link) => ({
    label: link.textContent?.replace(/\s+/g, " ").trim() ?? "",
    href: link.getAttribute("href"),
  }));
  const expectedLabels = expectedDestinations.map(({ label }) => label);
  const expectedHrefs = expectedDestinations.map(({ href }) => href);

  return {
    h1Count: document.querySelectorAll("h1").length,
    heading:
      nexusTitle?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    inputLabel:
      document.querySelector("label[for='platform-project-start']")
        ?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    privacyText: privacy?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    headingFirstScreen: firstScreen(nexusTitle),
    inputFirstScreen: firstScreen(projectInput),
    privacyFirstScreen: firstScreen(privacy),
    headingGeometry: elementGeometry(nexusTitle),
    inputGeometry: elementGeometry(projectInput),
    privacyGeometry: elementGeometry(privacy),
    phaseLabels: [
      ...nexus?.querySelectorAll(
        "[aria-label='Connected project lifecycle'] button strong",
      ) ?? [],
    ].map((element) => element.textContent?.trim() ?? ""),
    destinationLabels: destinationLinks.map(({ label }) => label),
    destinationHrefs: destinationLinks.map(({ href }) => href),
    expectedLabels,
    expectedHrefs,
  };
}, expectedPrimaryDestinations);
const homeNexusPassed =
  homeNexusState.h1Count === 1 &&
  /^Develop complex work\.\s*Keep the record intact\.$/.test(
    homeNexusState.heading,
  ) &&
  homeNexusState.inputLabel === "Describe the project or problem." &&
  /stored only in this browser tab/i.test(homeNexusState.privacyText) &&
  /not submitted to Kingxford or sent for AI review/i.test(
    homeNexusState.privacyText,
  ) &&
  homeNexusState.headingFirstScreen &&
  homeNexusState.inputFirstScreen &&
  homeNexusState.privacyFirstScreen &&
  JSON.stringify(homeNexusState.phaseLabels) ===
    JSON.stringify([
      "Discover",
      "Investigate",
      "Model",
      "Build",
      "Validate",
      "Deliver",
    ]) &&
  JSON.stringify(homeNexusState.destinationLabels) ===
    JSON.stringify(homeNexusState.expectedLabels) &&
  JSON.stringify(homeNexusState.destinationHrefs) ===
    JSON.stringify(homeNexusState.expectedHrefs);
results.push({
  interaction: "home-platform-nexus-first-screen",
  passed: homeNexusPassed,
  ...homeNexusState,
});
if (!homeNexusPassed) {
  failures.push({
    interaction: "home-platform-nexus-first-screen",
    ...homeNexusState,
  });
}

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
const scienceLabCommandPassed =
  scienceLabCommandResults.some(
    (result) =>
      result.id === "command-create" &&
      /seven build categories/i.test(result.text) &&
      /three concept demos/i.test(result.text) &&
      /open Canvas/i.test(result.text),
  ) &&
  scienceLabCommandResults.some(
    (result) =>
      result.id === "command-create-science" &&
      /lumen vale laboratory/i.test(result.text),
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

await desktop.page.locator("#intelligence-system").scrollIntoViewIfNeeded();
const operatingSystemState = await desktop.page
  .locator("#intelligence-system")
  .evaluate((system) => ({
    heading:
      system
        .querySelector("#intelligence-system-title")
        ?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    entryPointCount: system.querySelectorAll(
      "[aria-label='Platform entry lenses'] a",
    ).length,
    memoryFields: (
      system.querySelector("[aria-label='Project record'] strong")
        ?.textContent ?? ""
    )
      .split("·")
      .map((field) => field.trim())
      .filter(Boolean),
    specialistCount: system.querySelectorAll(
      "[aria-label='Review disciplines'] article",
    ).length,
    lifecycleLabels: [
      ...system.querySelectorAll(
        "[aria-label='Six connected project phases'] button strong",
      ),
    ].map((element) => element.textContent?.trim() ?? ""),
    conductor: system.querySelector("#conductor-title")?.textContent?.trim(),
    legacyDisconnectedSurfaceCount: document.querySelectorAll(
      ".kx-cinematic, .worlds__portal, .idea-router",
    ).length,
  }));

const lifecycleValidation = desktop.page
  .locator("[aria-label='Six connected project phases']")
  .getByRole("button", { name: /Validate/ });
await lifecycleValidation.click();
const lifecycleInteractionState = {
  validationSelected:
    (await lifecycleValidation.getAttribute("aria-pressed")) === "true",
  description:
    (await desktop.page.locator("#lifecycle-phase-description").textContent())
      ?.replace(/\s+/g, " ")
      .trim() ?? "",
  assignedSpecialistCount: await desktop.page.locator(
    "[aria-label='Review disciplines'] article[data-active='true']",
  ).count(),
};
const expectedLifecycleLabels = [
  "Discover",
  "Investigate",
  "Model",
  "Build",
  "Validate",
  "Deliver",
];
const operatingSystemPassed =
  /^Four starting points\.\s*One project record\.$/.test(
    operatingSystemState.heading,
  ) &&
  operatingSystemState.entryPointCount === 4 &&
  JSON.stringify(operatingSystemState.memoryFields) ===
    JSON.stringify(["Objective", "source", "evidence", "decisions"]) &&
  operatingSystemState.specialistCount === 6 &&
  JSON.stringify(operatingSystemState.lifecycleLabels) ===
    JSON.stringify(expectedLifecycleLabels) &&
  operatingSystemState.conductor === "Project review" &&
  operatingSystemState.legacyDisconnectedSurfaceCount === 0 &&
  lifecycleInteractionState.validationSelected &&
  /decision-ready validation record/i.test(
    lifecycleInteractionState.description,
  ) &&
  lifecycleInteractionState.assignedSpecialistCount === 2;
results.push({
  interaction: "unified-intelligence-operating-system",
  passed: operatingSystemPassed,
  ...operatingSystemState,
  lifecycleInteraction: lifecycleInteractionState,
});
if (!operatingSystemPassed) {
  failures.push({
    interaction: "unified-intelligence-operating-system",
    ...operatingSystemState,
    lifecycleInteraction: lifecycleInteractionState,
  });
}
await desktop.page.screenshot({
  path: path.join(
    outputDir,
    "kingxford-intelligence-operating-system.png",
  ),
  fullPage: false,
});

const routedIdea =
  "A research platform for scientific evidence and academic data";
await desktop.page.locator("#platform-project-start").scrollIntoViewIfNeeded();
await desktop.page.locator("#platform-project-start").fill(routedIdea);
await Promise.all([
  desktop.page.waitForURL(
    "**/create/workspace?start=seed&phase=discovery&mode=idea",
  ),
  desktop.page.getByRole("button", { name: /Start project/ }).click(),
]);
await desktop.page.locator("#workspace-text-editor").waitFor({
  state: "visible",
});
await desktop.page.waitForFunction((expectedInput) => {
  const editor = document.querySelector("#workspace-text-editor");
  let projectCount = 0;
  try {
    const repository = JSON.parse(
      window.localStorage.getItem("kingxford:projects:v2") ?? "null",
    );
    projectCount = Array.isArray(repository?.projects)
      ? repository.projects.length
      : 0;
  } catch {
    projectCount = 0;
  }
  return (
    editor instanceof HTMLTextAreaElement &&
    editor.value === expectedInput &&
    projectCount >= 1 &&
    window.sessionStorage.getItem("kingxford:project-seed:v1") === null
  );
}, routedIdea);
const ideaTransferState = await desktop.page.evaluate(() => ({
  input:
    document.querySelector("#workspace-text-editor") instanceof
    HTMLTextAreaElement
      ? document.querySelector("#workspace-text-editor").value
      : "",
  seedConsumed:
    window.sessionStorage.getItem("kingxford:project-seed:v1") === null,
  userContentInUrl: window.location.href.includes("scientific evidence"),
  projectCount: (() => {
    try {
      const value = JSON.parse(
        window.localStorage.getItem("kingxford:projects:v2") ?? "null",
      );
      return Array.isArray(value?.projects) ? value.projects.length : 0;
    } catch {
      return 0;
    }
  })(),
}));
const ideaTransferPassed =
  ideaTransferState.input === routedIdea &&
  ideaTransferState.seedConsumed &&
  !ideaTransferState.userContentInUrl &&
  ideaTransferState.projectCount >= 1;
results.push({
  interaction: "idea-to-project-context-transfer",
  passed: ideaTransferPassed,
  ...ideaTransferState,
});
if (!ideaTransferPassed) {
  failures.push({
    interaction: "idea-to-project-context-transfer",
    ...ideaTransferState,
  });
}

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
    heading: "Keep assumptions, evidence, and review history with each decision.",
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
  const canvasNav = document.querySelector(
    ".site-header__desktop-nav .site-header__create-link",
  );
  const embeddedCanvas = document.querySelector("[data-embedded='true']");
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
    currentNav: canvasNav?.getAttribute("aria-current") === "page",
    embeddedCanvas: Boolean(embeddedCanvas),
    embeddedCanvasHeading:
      embeddedCanvas
        ?.querySelector("#canvas-title")
        ?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    embeddedModeCount:
      embeddedCanvas?.querySelectorAll(
        "[role='tab'][id^='workspace-mode-']",
      ).length ?? 0,
    embeddedResultTabCount:
      embeddedCanvas?.querySelectorAll(
        "[aria-label='Result views'] [role='tab']",
      ).length ?? 0,
    embeddedConductorTab: Boolean(
      embeddedCanvas?.querySelector("#workspace-result-tab-intelligence"),
    ),
    embeddedProjectLibrary: [...embeddedCanvas?.querySelectorAll("button") ?? []]
      .some((button) => button.textContent?.trim() === "Library"),
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
  createIndexState.heading === "What do you need to create?" &&
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
  createIndexState.embeddedCanvas &&
  createIndexState.embeddedCanvasHeading ===
    "Develop an idea into a testable prototype." &&
  createIndexState.embeddedModeCount === 5 &&
  createIndexState.embeddedResultTabCount === 4 &&
  createIndexState.embeddedConductorTab &&
  createIndexState.embeddedProjectLibrary &&
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
      document.querySelector("[aria-label='Project input editor']"),
    ),
    hasResultPane: Boolean(
      document.querySelector("[aria-label='Preview, project review, and version history']"),
    ),
    resultTabLabels: [
      ...document.querySelectorAll("[aria-label='Result views'] [role='tab']"),
    ].map((tab) => tab.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    hasProjectLibraryButton: [...document.querySelectorAll("button")].some(
      (button) => button.textContent?.trim() === "Library",
    ),
    schemaType: schema?.["@type"] ?? null,
  };
});
const canvasRoutePassed =
  canvas.record.status === 200 &&
  canvasRouteState.heading === "Develop an idea into a testable prototype." &&
  canvasRouteState.modeCount === 5 &&
  canvasRouteState.selectedMode === "workspace-mode-idea" &&
  canvasRouteState.hasWorkbench &&
  canvasRouteState.hasResultPane &&
  JSON.stringify(canvasRouteState.resultTabLabels) ===
    JSON.stringify([
      "Live preview",
      "Conductor",
      "Agent review",
      "Versions 0",
    ]) &&
  canvasRouteState.hasProjectLibraryButton &&
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

const desktopLibraryButton = canvas.page.getByRole("button", {
  name: "Library",
  exact: true,
});
await desktopLibraryButton.click();
const desktopProjectLibrary = canvas.page.getByRole("dialog", {
  name: "Your projects",
});
await desktopProjectLibrary.waitFor({ state: "visible" });
const desktopProjectLibraryState = {
  buttonVisible: await desktopLibraryButton.isVisible(),
  dialogVisible: await desktopProjectLibrary.isVisible(),
  description:
    (await desktopProjectLibrary
      .locator("#project-library-description")
      .textContent())
      ?.replace(/\s+/g, " ")
      .trim() ?? "",
  projectCount: await desktopProjectLibrary.locator("ol > li").count(),
};
const desktopProjectLibraryPassed =
  desktopProjectLibraryState.buttonVisible &&
  desktopProjectLibraryState.dialogVisible &&
  /drafts, evidence, decisions, revisions, and review history intact/i.test(
    desktopProjectLibraryState.description,
  ) &&
  desktopProjectLibraryState.projectCount >= 1;
results.push({
  interaction: "canvas-project-library-desktop",
  passed: desktopProjectLibraryPassed,
  ...desktopProjectLibraryState,
});
if (!desktopProjectLibraryPassed) {
  failures.push({
    interaction: "canvas-project-library-desktop",
    ...desktopProjectLibraryState,
  });
}
await desktopProjectLibrary
  .getByRole("button", { name: "Close project library" })
  .click();
await desktopProjectLibrary.waitFor({ state: "hidden" });

const desktopConductorTab = canvas.page
  .locator("[aria-label='Result views']")
  .getByRole("tab", {
    name: "Conductor",
    exact: true,
  });
await desktopConductorTab.click();
const desktopConductorPanel = canvas.page.locator(
  "#workspace-intelligence-panel",
);
await desktopConductorPanel.waitFor({ state: "visible" });
const desktopConductorText =
  (await desktopConductorPanel.textContent())?.replace(/\s+/g, " ").trim() ??
  "";
const desktopConductorPassed =
  (await desktopConductorTab.getAttribute("aria-selected")) === "true" &&
  /Project review/i.test(desktopConductorText) &&
  /Review the current project revision/i.test(desktopConductorText) &&
  /up to two specialist reviews/i.test(desktopConductorText) &&
  /You decide whether to accept it/i.test(desktopConductorText);
results.push({
  interaction: "canvas-conductor-tab-desktop",
  passed: desktopConductorPassed,
  panelText: desktopConductorText.slice(0, 520),
});
if (!desktopConductorPassed) {
  failures.push({
    interaction: "canvas-conductor-tab-desktop",
    panelText: desktopConductorText.slice(0, 520),
  });
}
await canvas.page
  .locator("[aria-label='Result views']")
  .getByRole("tab", { name: "Live preview", exact: true })
  .click();

const canvasModeChecks = [];
for (const expected of [
  { mode: "idea", previewSelector: "[aria-label='Local concept preview']", text: "Concept preview" },
  { mode: "code", previewSelector: "iframe[title='Live code preview']", text: "Isolated browser" },
  { mode: "mindmap", previewSelector: "[aria-label='Mind map preview']", text: "Mind map" },
  { mode: "prompt", previewSelector: "#workspace-preview-panel article", text: "Prompt review" },
  { mode: "brief", previewSelector: "#workspace-preview-panel article", text: "Working brief" },
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
  .locator("[aria-label='Project input editor']")
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
  /Select the context to include/.test(canvasAgentPanelText ?? "") &&
  /Only the selected context and project snapshot are sent when you choose\s+Review/.test(canvasAgentPanelText ?? "") &&
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
  name: "Request an implementation plan for this project.",
});
await canvasHandoff.waitFor({ state: "visible" });
const disconnectedEntrepreneurshipControls = canvasHandoff.getByRole(
  "button",
  { name: /Entrepreneurship/i },
);
const handoffSessionAfter = await canvas.page.evaluate(() =>
  window.sessionStorage.getItem("kingxford:canvas-handoff:v1"),
);
const canvasHandoffState = {
  dialogVisible: await canvasHandoff.isVisible(),
  currentVersionIncluded: await canvasHandoff
    .getByLabel("Current version", { exact: true })
    .isChecked(),
  disconnectedEntrepreneurshipControlCount:
    await disconnectedEntrepreneurshipControls.count(),
  locationUnchanged: canvas.page.url() === canvasLocationBeforeHandoff,
  sessionUntouched:
    handoffSessionBefore === null && handoffSessionAfter === null,
  postRequestsAfterOpen:
    canvasPostRequests.length - postCountBeforeHandoff,
};
const canvasHandoffPassed =
  canvasHandoffState.dialogVisible &&
  canvasHandoffState.currentVersionIncluded &&
  canvasHandoffState.disconnectedEntrepreneurshipControlCount === 0 &&
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
    const canvasNav = document.querySelector(
      ".site-header__desktop-nav .site-header__create-link",
    );
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
      currentNav: canvasNav?.getAttribute("aria-current") === "location",
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
const createHeaderState = await createHeader.page.evaluate((expectedDestinations) => {
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
    navDestinations: [...nav.querySelectorAll(".site-header__nav-link")].map(
      (link) => ({
        label: link.textContent?.replace(/\s+/g, " ").trim() ?? "",
        href: link.getAttribute("href"),
      }),
    ),
    expectedDestinations,
    currentNav:
      nav
        .querySelector(".site-header__nav-link[href='/create']")
        ?.getAttribute("aria-current") === "page",
    brandNavOverlap: Math.max(0, brandRect.right - navRect.left),
    navActionsOverlap: Math.max(0, navRect.right - actionsRect.left),
  };
}, expectedPrimaryDestinations);
const createHeaderPassed =
  createHeaderState.elementsPresent &&
  createHeaderState.navDisplay !== "none" &&
  createHeaderState.navLinkCount === 5 &&
  JSON.stringify(createHeaderState.navDestinations) ===
    JSON.stringify(createHeaderState.expectedDestinations) &&
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
await mobile.page
  .locator(".site-header__mobile-create > summary")
  .click();
const mobileDestinationState = await mobile.page.evaluate(
  (expectedDestinations) => {
    const primaryLinks = [
      ...document.querySelectorAll(
        ".site-header__mobile-panel nav > .site-header__nav-link",
      ),
    ].map((link) => ({
      label: link.textContent?.replace(/\s+/g, " ").trim() ?? "",
      href: link.getAttribute("href"),
    }));
    const canvasSummary = document.querySelector(
      ".site-header__mobile-create > summary strong",
    );
    const createLink = document.querySelector(
      ".site-header__mobile-create-links a[href='/create']",
    );
    return {
      destinations: [
        ...primaryLinks,
        {
          label: canvasSummary?.textContent?.trim() ?? "",
          href: createLink?.getAttribute("href") ?? null,
        },
      ],
      expectedDestinations,
      canvasExpanded: Boolean(
        document.querySelector(".site-header__mobile-create[open]"),
      ),
    };
  },
  expectedPrimaryDestinations,
);
const mobileDestinationsPassed =
  mobileDestinationState.canvasExpanded &&
  JSON.stringify(mobileDestinationState.destinations) ===
    JSON.stringify(mobileDestinationState.expectedDestinations);
results.push({
  interaction: "mobile-five-destination-navigation",
  passed: mobileDestinationsPassed,
  ...mobileDestinationState,
});
if (!mobileDestinationsPassed) {
  failures.push({
    interaction: "mobile-five-destination-navigation",
    ...mobileDestinationState,
  });
}
await mobile.page.screenshot({
  path: path.join(outputDir, "home-mobile-menu.png"),
  fullPage: false,
});
await menuSummary.click();
await mobile.page.locator("#platform-project-start").scrollIntoViewIfNeeded();
await mobile.page.waitForTimeout(120);
await mobile.page.screenshot({
  path: path.join(outputDir, "kingxford-mobile-nexus.png"),
  fullPage: false,
});
await mobile.page.locator("#intelligence-system").scrollIntoViewIfNeeded();
await mobile.page.waitForTimeout(120);
await mobile.page.screenshot({
  path: path.join(outputDir, "kingxford-mobile-intelligence-system.png"),
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
  canvasSectionCurrent:
    (await mobileCreate.page
      .locator(".site-header__mobile-create")
      .getAttribute("data-current")) === "true",
  canvasSectionVisible: await mobileCreate.page
    .locator(".site-header__mobile-create > summary")
    .isVisible(),
  canvasWorkspaceLinkVisible: await mobileCreate.page
    .locator(".site-header__mobile-canvas[href='/create/workspace']")
    .isVisible(),
  embeddedCanvas: await mobileCreate.page
    .locator("[data-embedded='true']")
    .count(),
  embeddedConductorTab: await mobileCreate.page
    .locator("[data-embedded='true'] [aria-label='Mobile workspace panes']")
    .getByRole("button", { name: "Conductor", exact: true })
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
  mobileCreateState.canvasSectionCurrent &&
  mobileCreateState.canvasSectionVisible &&
  mobileCreateState.canvasWorkspaceLinkVisible &&
  mobileCreateState.embeddedCanvas === 1 &&
  mobileCreateState.embeddedConductorTab &&
  mobileCreateState.featuredCount === 3 &&
  mobileCreateState.heading?.trim() === "What do you need to create?";
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
const mobileCanvasConductorTab = mobileCanvasTabs.getByRole("button", {
  name: "Conductor",
  exact: true,
});
const mobileCanvasAgentTab = mobileCanvasTabs.getByRole("button", {
  name: "Agent",
  exact: true,
});
const mobileWorkbench = mobileCanvas.page.locator(
  "[aria-label='Project input editor']",
);
const mobileResultPane = mobileCanvas.page.locator(
  "[aria-label='Preview, project review, and version history']",
);
const mobilePreviewPanel = mobileCanvas.page.locator(
  "#workspace-preview-panel",
);
const mobileConductorPanel = mobileCanvas.page.locator(
  "#workspace-intelligence-panel",
);
const mobileAgentPanel = mobileCanvas.page.locator("#workspace-agent-panel");

const mobileLibraryButton = mobileCanvas.page.getByRole("button", {
  name: "Library",
  exact: true,
});
const mobileLibraryButtonVisible = await mobileLibraryButton.isVisible();
await mobileLibraryButton.click();
const mobileProjectLibrary = mobileCanvas.page.getByRole("dialog", {
  name: "Your projects",
});
await mobileProjectLibrary.waitFor({ state: "visible" });
const mobileProjectLibraryState = {
  buttonVisible: mobileLibraryButtonVisible,
  dialogVisible: await mobileProjectLibrary.isVisible(),
  closeVisible: await mobileProjectLibrary
    .getByRole("button", { name: "Close project library" })
    .isVisible(),
  projectCount: await mobileProjectLibrary.locator("ol > li").count(),
};
const mobileProjectLibraryPassed =
  mobileProjectLibraryState.buttonVisible &&
  mobileProjectLibraryState.dialogVisible &&
  mobileProjectLibraryState.closeVisible &&
  mobileProjectLibraryState.projectCount >= 1;
results.push({
  interaction: "canvas-project-library-mobile",
  passed: mobileProjectLibraryPassed,
  ...mobileProjectLibraryState,
});
if (!mobileProjectLibraryPassed) {
  failures.push({
    interaction: "canvas-project-library-mobile",
    ...mobileProjectLibraryState,
  });
}
await mobileProjectLibrary
  .getByRole("button", { name: "Close project library" })
  .click();
await mobileProjectLibrary.waitFor({ state: "hidden" });

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
  conductorHidden: !(await mobileConductorPanel.isVisible()),
  agentHidden: !(await mobileAgentPanel.isVisible()),
  conceptVisible: await mobilePreviewPanel
    .locator("[aria-label='Local concept preview']")
    .isVisible(),
};
await mobileCanvas.page.screenshot({
  path: path.join(outputDir, "canvas-mobile-preview-390.png"),
  fullPage: false,
});

await mobileCanvasConductorTab.click();
await mobileConductorPanel.waitFor({ state: "visible" });
const mobileConductorText = await mobileConductorPanel.textContent();
const mobileCanvasConductorState = {
  pane: await mobileCanvas.page
    .locator("main[data-mobile-pane]")
    .getAttribute("data-mobile-pane"),
  selected:
    (await mobileCanvasConductorTab.getAttribute("aria-pressed")) === "true",
  workbenchHidden: !(await mobileWorkbench.isVisible()),
  resultVisible: await mobileResultPane.isVisible(),
  previewHidden: !(await mobilePreviewPanel.isVisible()),
  conductorVisible: await mobileConductorPanel.isVisible(),
  agentHidden: !(await mobileAgentPanel.isVisible()),
  governedControlVisible:
    /Project review/.test(mobileConductorText ?? "") &&
    /Review the current project revision/.test(
      mobileConductorText ?? "",
    ) &&
    /up to two specialist reviews/.test(mobileConductorText ?? "") &&
    /You decide whether to accept it/.test(mobileConductorText ?? ""),
};
await mobileCanvas.page.screenshot({
  path: path.join(outputDir, "canvas-mobile-conductor-390.png"),
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
  conductorHidden: !(await mobileConductorPanel.isVisible()),
  agentVisible: await mobileAgentPanel.isVisible(),
  contextDisclosureVisible:
    /Select the context to include/.test(mobileAgentText ?? "") &&
    /Only the selected context and project snapshot are sent when you choose\s+Review/.test(mobileAgentText ?? ""),
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
  mobileCanvasPreviewState.conductorHidden &&
  mobileCanvasPreviewState.agentHidden &&
  mobileCanvasPreviewState.conceptVisible &&
  mobileCanvasConductorState.pane === "intelligence" &&
  mobileCanvasConductorState.selected &&
  mobileCanvasConductorState.workbenchHidden &&
  mobileCanvasConductorState.resultVisible &&
  mobileCanvasConductorState.previewHidden &&
  mobileCanvasConductorState.conductorVisible &&
  mobileCanvasConductorState.agentHidden &&
  mobileCanvasConductorState.governedControlVisible &&
  mobileCanvasAgentState.pane === "agent" &&
  mobileCanvasAgentState.selected &&
  mobileCanvasAgentState.workbenchHidden &&
  mobileCanvasAgentState.resultVisible &&
  mobileCanvasAgentState.previewHidden &&
  mobileCanvasAgentState.conductorHidden &&
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
  conductor: mobileCanvasConductorState,
  agent: mobileCanvasAgentState,
  returnedInput: mobileCanvasReturnState,
});
if (!mobileCanvasPassed) {
  failures.push({
    interaction: "canvas-mobile-pane-navigation",
    input: mobileCanvasInputState,
    preview: mobileCanvasPreviewState,
    conductor: mobileCanvasConductorState,
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
const reducedPlatform = await reduced.page.evaluate(() => {
  const nexusTitle = document.querySelector("#platform-nexus-title");
  const nexus = nexusTitle?.closest("section");
  const animatedNexusElements = nexus
    ? [...nexus.querySelectorAll("*")].filter((element) => {
        const style = getComputedStyle(element);
        return (
          style.animationName !== "none" &&
          !style.animationDuration.split(",").every((value) =>
            ["0s", "0ms"].includes(value.trim()),
          )
        );
      }).length
    : -1;
  return {
    headingVisible:
      nexusTitle instanceof HTMLElement &&
      nexusTitle.getBoundingClientRect().width > 0 &&
      nexusTitle.getBoundingClientRect().height > 0,
    inputVisible:
      document.querySelector("#platform-project-start") instanceof
      HTMLTextAreaElement,
    operatingSystemPresent: Boolean(
      document.querySelector("#intelligence-system"),
    ),
    phaseCount:
      document.querySelectorAll(
        "[aria-label='Six connected project phases'] button",
      ).length,
    animatedNexusElements,
  };
});
const reducedPlatformPassed =
  reducedPlatform.headingVisible &&
  reducedPlatform.inputVisible &&
  reducedPlatform.operatingSystemPresent &&
  reducedPlatform.phaseCount === 6 &&
  reducedPlatform.animatedNexusElements === 0;
results.push({
  interaction: "kingxford-reduced-motion-platform",
  passed: reducedPlatformPassed,
  ...reducedPlatform,
});
if (!reducedPlatformPassed) {
  failures.push({
    interaction: "kingxford-reduced-motion-platform",
    ...reducedPlatform,
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
