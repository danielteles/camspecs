#!/usr/bin/env node
// Runs only the Vitest test files affected by changed source files, instead
// of the full suite every time. Used by .husky/pre-commit (staged files)
// and .github/workflows/ci.yml (files changed vs. the PR/push base ref).
//
// Usage:
//   node scripts/run-related-tests.mjs               (pre-commit: staged files)
//   node scripts/run-related-tests.mjs --base <ref>   (CI: files changed vs. ref)

import { execFileSync } from "node:child_process";
import { extname } from "node:path";

const TESTABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

// Changes to these affect the whole test environment (config, i18n
// messages every component test reads, or the shared mocks/setup file)
// rather than a specific module in the dependency graph, so `vitest
// related` can't be trusted to find everything they touch — run the full
// suite instead.
const FORCES_FULL_RUN = [
  /^package(-lock)?\.json$/,
  /^vitest\.config\.mts$/,
  /^vitest\.setup\.tsx$/,
  /^messages\/.*\.json$/,
  /^test\/mocks\//,
];

function getChangedFiles() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const base = baseIndex !== -1 ? args[baseIndex + 1] : undefined;

  const diffArgs =
    base && base !== "0000000000000000000000000000000000000000"
      ? ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]
      : ["diff", "--cached", "--name-only", "--diff-filter=ACMR"];

  const output = execFileSync("git", diffArgs, { encoding: "utf-8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runFullSuite() {
  execFileSync("npx", ["vitest", "run"], { stdio: "inherit" });
}

function main() {
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log("No changed files detected — skipping tests.");
    return;
  }

  if (changedFiles.some((file) => FORCES_FULL_RUN.some((p) => p.test(file)))) {
    console.log(
      "Config, i18n messages, or shared test mocks changed — running the full test suite.",
    );
    runFullSuite();
    return;
  }

  const testableFiles = changedFiles.filter((file) =>
    TESTABLE_EXTENSIONS.has(extname(file)),
  );

  if (testableFiles.length === 0) {
    console.log("No testable source files changed — skipping tests.");
    return;
  }

  console.log(
    `Running tests related to ${testableFiles.length} changed file(s):\n` +
      testableFiles.map((f) => `  - ${f}`).join("\n"),
  );
  execFileSync("npx", ["vitest", "related", ...testableFiles], {
    stdio: "inherit",
  });
}

main();
