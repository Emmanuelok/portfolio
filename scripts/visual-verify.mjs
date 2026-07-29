import fs from "node:fs/promises";
import path from "node:path";

import chromiumBinary from "@sparticuz/chromium";
import { chromium } from "playwright-core";

const baseUrl = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.resolve("verification");
await fs.mkdir(outputDir, { recursive: true });

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

  if (options.blockMotionVideo !== false) {
    await page.route(
      "https://d8j0ntlcm91z4.cloudfront.net/**",
      (route) => route.abort("blockedbyclient"),
    );
  }

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("ERR_BLOCKED_BY_CLIENT")
    ) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "networkidle",
  });
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
    consoleErrors,
    pageErrors,
    audit,
  };
  results.push(record);

  if (
    !response?.ok() ||
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
await desktop.page.keyboard.press("Escape");

const storyMetrics = await desktop.page.locator(".studio-story").evaluate((story) => {
  const stage = story.querySelector(".studio-story__stage");
  const poster = story.querySelector(".studio-story__poster");
  const rect = story.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    height: rect.height,
    viewportHeight: window.innerHeight,
    chapterCount: story.querySelectorAll(".studio-story__chapter").length,
    stagePosition: stage ? getComputedStyle(stage).position : null,
    posterReady:
      poster instanceof HTMLImageElement &&
      poster.complete &&
      poster.naturalWidth > 0,
  };
});
const storyStructurePassed =
  storyMetrics.chapterCount === 4 &&
  storyMetrics.stagePosition === "sticky" &&
  storyMetrics.posterReady &&
  storyMetrics.height > storyMetrics.viewportHeight * 3;
results.push({
  interaction: "living-room-story-structure",
  passed: storyStructurePassed,
  ...storyMetrics,
});
if (!storyStructurePassed) {
  failures.push({
    interaction: "living-room-story-structure",
    ...storyMetrics,
  });
}

for (const [chapter, progress] of [
  ["threshold", 0.08],
  ["signal", 0.34],
  ["point-of-view", 0.61],
  ["gallery", 0.88],
]) {
  await desktop.page.evaluate(
    ({ top, height, viewportHeight, progress }) => {
      window.scrollTo({
        top: top + (height - viewportHeight) * progress,
        behavior: "instant",
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
  await desktop.page.screenshot({
    path: path.join(outputDir, `living-room-${chapter}.png`),
    fullPage: false,
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
const mobileStoryMetrics = await mobile.page
  .locator(".studio-story")
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
      behavior: "instant",
    });
  },
  mobileStoryMetrics,
);
await mobile.page.waitForTimeout(180);
await mobile.page.screenshot({
  path: path.join(outputDir, "living-room-mobile-signal.png"),
  fullPage: false,
});
await mobile.context.close();

const mobileWork = await inspectPage(
  "work-mobile-390",
  "/work",
  { width: 390, height: 844 },
);
await mobileWork.context.close();

const project = await inspectPage(
  "project-kisuyo-1440",
  "/work/kisuyo",
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
await reduced.page.locator(".studio-story").scrollIntoViewIfNeeded();
await reduced.page.waitForTimeout(500);
const reducedStory = await reduced.page.locator(".studio-story").evaluate((story) => {
  const stage = story.querySelector(".studio-story__stage");
  return {
    markedReduced: story.getAttribute("data-reduced-motion") === "true",
    sourceCount: story.querySelectorAll("video source").length,
    stagePosition: stage ? getComputedStyle(stage).position : null,
    chapterCount: story.querySelectorAll(".studio-story__chapter").length,
  };
});
const reducedStoryPassed =
  reducedStory.sourceCount === 0 &&
  reducedStory.stagePosition !== "sticky" &&
  reducedStory.chapterCount === 4;
results.push({
  interaction: "living-room-reduced-motion-fallback",
  passed: reducedStoryPassed,
  ...reducedStory,
});
if (!reducedStoryPassed) {
  failures.push({
    interaction: "living-room-reduced-motion-fallback",
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
