import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Half of the platform's rendered words once sat between 7.4px and 11.7px, and
// a 12px floor still read as small. This guard keeps every declared text size at
// or above 14px at the 16px root, and routes the small end of the range through
// the shared scale so the steps stay ordered.
const repositoryRoot = process.cwd();
const styleRoot = "src";
const rootPixels = 16;
const floorPixels = 14;
const floorRem = floorPixels / rootPixels;

// The scale itself, and the ceiling below which a raw value must use a token
// rather than an inline number. Above 1rem a bespoke size is legible on its own
// and need not join the scale; below it the steps have to stay ordered.
const scaleTokens = new Set([
  "--type-2xs",
  "--type-xs",
  "--type-s",
  "--type-m",
  "--type-l",
]);
const tokenCeilingRem = 1;

// SVG text is drawn in viewBox units and scaled by the rendered width, so a
// raw px size there is not a px size on screen. These files size chart labels
// per breakpoint and are verified in the browser instead.
const svgUnitFiles = new Set([
  "src/components/showcase/FinanceExperience.module.css",
]);

async function collectStylesheets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectStylesheets(target)));
    } else if (entry.name.endsWith(".css")) {
      found.push(target);
    }
  }
  return found;
}

// Pulls the size out of a `font:` shorthand: the first length that is not a
// unitless weight and not nested inside clamp()/min()/max().
function shorthandSize(value) {
  if (/\b(?:clamp|min|max)\(/.test(value)) return null;
  const match = /(?<![\w.(])([0-9]*\.?[0-9]+)(rem|px|em)/.exec(value);
  return match ? { number: Number(match[1]), unit: match[2] } : null;
}

const failures = [];
const files = await collectStylesheets(path.join(repositoryRoot, styleRoot));
let declarations = 0;

for (const file of files) {
  const relative = path.relative(repositoryRoot, file);
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);

  lines.forEach((line, index) => {
    const at = `${relative}:${index + 1}`;
    const longhand = /(?<![-\w])font-size:\s*([^;]+);/.exec(line);
    const shorthand = /(?<![-\w])font:\s*([^;]+);/.exec(line);
    const value = longhand?.[1] ?? shorthand?.[1];
    if (!value || value.trim() === "inherit") return;
    declarations += 1;

    // A token or a var() reference is already on the scale.
    if (/var\(--type-/.test(value)) {
      const named = /var\((--type-[a-z0-9]+)/.exec(value);
      if (named && !scaleTokens.has(named[1])) {
        failures.push(`${at} uses unknown scale token ${named[1]}`);
      }
      return;
    }

    const size = longhand
      ? shorthandSize(value) ?? (/\b(?:clamp|min|max)\(/.test(value) ? null : null)
      : shorthandSize(value);

    // clamp()/min()/max() expressions are checked on their smallest term.
    if (/\b(?:clamp|min|max)\(/.test(value)) {
      const terms = [...value.matchAll(/([0-9]*\.?[0-9]+)(rem|px)/g)];
      const smallest = terms.reduce((low, term) => {
        const px = term[2] === "px" ? Number(term[1]) : Number(term[1]) * rootPixels;
        return px < low ? px : low;
      }, Number.POSITIVE_INFINITY);
      if (Number.isFinite(smallest) && smallest < floorPixels) {
        failures.push(
          `${at} can resolve to ${smallest.toFixed(1)}px, below the ${floorPixels}px floor`,
        );
      }
      return;
    }

    if (!size) return;
    if (size.unit === "em") return; // Relative to a parent this check cannot see.

    const pixels = size.unit === "px" ? size.number : size.number * rootPixels;
    if (size.unit === "px" && svgUnitFiles.has(relative)) return;

    if (pixels < floorPixels) {
      failures.push(
        `${at} sets ${size.number}${size.unit} (${pixels.toFixed(1)}px), below the ${floorPixels}px floor`,
      );
      return;
    }
    if (size.unit === "rem" && size.number < tokenCeilingRem) {
      failures.push(
        `${at} sets ${size.number}rem directly; use a --type-* token so the small end of the scale stays ordered`,
      );
    }
  });
}

// The scale must exist, start at the floor, and rise.
const globals = await readFile(path.join(repositoryRoot, "src/app/globals.css"), "utf8");
const declared = [...scaleTokens].map((token) => {
  const match = new RegExp(`${token}:\\s*([0-9.]+)rem`).exec(globals);
  return { token, rem: match ? Number(match[1]) : null };
});
for (const { token, rem } of declared) {
  if (rem === null) failures.push(`src/app/globals.css is missing ${token}`);
  else if (rem < floorRem) {
    failures.push(`${token} is ${rem}rem, below the ${floorPixels}px floor`);
  }
}
const ordered = declared.every(
  (entry, index) => index === 0 || (entry.rem ?? 0) > (declared[index - 1].rem ?? 0),
);
if (!ordered) failures.push("--type-* tokens are not in ascending order");

if (failures.length) {
  console.error("Legible type verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Legible type verification passed (${files.length} stylesheets, ${declarations} text-size declarations, ${floorPixels}px floor).`,
  );
}
