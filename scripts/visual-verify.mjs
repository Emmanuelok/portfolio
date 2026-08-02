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
    heading: "Research made inspectable.",
  },
  {
    slug: "meridian-financial-office",
    name: "Meridian Financial Office",
    sector: "finance",
    heading: "Capital governed by mandate.",
  },
  {
    slug: "commonfield-institute",
    name: "Commonfield Institute",
    sector: "education",
    heading: "Learn by building the question.",
  },
];

const create = await inspectPage(
  "create-desktop-1440",
  "/create",
  { width: 1440, height: 1000 },
);
const createIndexState = await create.page.evaluate((expectedShowcases) => {
  const cards = [...document.querySelectorAll("#websites article[data-sector]")];
  const detailHrefs = [
    ...new Set(
      [...document.querySelectorAll("#websites a[href^='/create/']")]
        .map((link) => link.getAttribute("href"))
        .filter(Boolean),
    ),
  ];
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
    featuredCount: cards.length,
    sectors: cards
      .map((card) => card.getAttribute("data-sector"))
      .filter(Boolean)
      .sort(),
    detailHrefs: detailHrefs.sort(),
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
const createIndexPassed =
  createIndexState.heading === "What should exist next?" &&
  createIndexState.featuredCount === 3 &&
  JSON.stringify(createIndexState.sectors) ===
    JSON.stringify(["education", "finance", "science"]) &&
  JSON.stringify(createIndexState.detailHrefs) ===
    JSON.stringify(createIndexState.expectedHrefs) &&
  createIndexState.catalogueCount === 7 &&
  createIndexState.currentNav &&
  createIndexState.schemaType === "CollectionPage" &&
  createIndexState.schemaPartCount === 3;
results.push({
  interaction: "create-index",
  passed: createIndexPassed,
  ...createIndexState,
});
if (!createIndexPassed) {
  failures.push({ interaction: "create-index", ...createIndexState });
}

const sitemapResponse = await create.context.request.get(
  `${baseUrl}/sitemap.xml`,
);
const sitemapText = await sitemapResponse.text();
const expectedCreateSitemapPaths = [
  "/create",
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
    detailState.breadcrumbCount === 2;
  results.push({
    interaction: `create-detail-${expected.slug}`,
    passed: detailPassed,
    ...detailState,
  });
  if (!detailPassed) {
    failures.push({
      interaction: `create-detail-${expected.slug}`,
      ...detailState,
    });
  }
  await detail.context.close();
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
    .locator("#websites article[data-sector]")
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
