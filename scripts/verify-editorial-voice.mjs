import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = process.cwd();
const sourceTargets = [
  "src/app",
  "src/components",
  "src/data",
  "src/lib/platform.ts",
  "src/lib/platform/registry.ts",
];

const prohibitedPhrases = [
  "Kingxford Intelligence Platform",
  "one intelligence operating system",
  "one intelligence system",
  "specialist intelligence",
  "coordinating intelligence",
  "coordinated intelligences",
  "intelligence assigned",
  "whole intelligence",
  "abundant future",
  "abundant futures",
  "ambitious future",
  "ambitious futures",
  "future it demands",
  "bring the ambition",
  "unforgettable form",
  "creative intelligence workspace",
  "open the intelligence workspace",
  "your connected intelligence",
  "governed orchestration",
  "evidence-bound Conductor run",
  "final Conductor synthesis",
  "AI-powered",
  "cutting-edge",
  "game-changing",
  "world-class",
  "revolutionary",
  "seamless",
  "supercharge",
];

async function collectSourceFiles(target) {
  const absoluteTarget = path.join(repositoryRoot, target);
  if (/\.(?:ts|tsx)$/.test(target)) return [absoluteTarget];

  const entries = await readdir(absoluteTarget, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const child = path.join(absoluteTarget, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(path.relative(repositoryRoot, child));
      }
      return /\.(?:ts|tsx)$/.test(entry.name) ? [child] : [];
    }),
  );
  return files.flat();
}

const files = (
  await Promise.all(sourceTargets.map((target) => collectSourceFiles(target)))
).flat();
const failures = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/);

  for (const phrase of prohibitedPhrases) {
    const normalizedPhrase = phrase.toLocaleLowerCase();
    lines.forEach((line, index) => {
      if (line.toLocaleLowerCase().includes(normalizedPhrase)) {
        failures.push(
          `${path.relative(repositoryRoot, file)}:${index + 1} contains “${phrase}”`,
        );
      }
    });
  }
}

if (failures.length) {
  console.error("Editorial voice verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Editorial voice verification passed (${files.length} source files, ${prohibitedPhrases.length} prohibited phrases).`,
  );
}
