import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { testWorkspaces } from "./run-workspace-tests.mjs";

export const CI_SOURCES = [
  "scripts/check-markdown-links.mjs",
  "scripts/merge-coverage.mjs",
  "scripts/quality-gate.mjs",
  "scripts/run-integration-tests.mjs",
  "scripts/run-workspace-tests.mjs",
];

// Vitest sources are workspace-relative; Node's LCOV sources are repository-relative.
export function mergeCoverage(reports, root) {
  if (reports.length === 0) throw new Error("No workspace LCOV reports found");
  return reports.map((report) => normalizeReport(report, root)).join("\n");
}

function normalizeReport(
  { path, content, sourceRoot, expectedSources = [] },
  root,
) {
  const workspace =
    sourceRoot === undefined
      ? dirname(dirname(resolve(root, path)))
      : resolve(root, sourceRoot);
  const sources = new Set();
  let sourceCount = 0;
  const normalized = content.replace(/^SF:(.+)\r?$/gm, (_, source) => {
    const absolute = resolve(workspace, source.trim().replaceAll("\\", "/"));
    const local = relative(root, absolute);
    if (
      isAbsolute(local) ||
      local === ".." ||
      local.startsWith(`..${sep}`) ||
      !existsSync(absolute)
    ) {
      throw new Error(`Unresolvable LCOV source in ${path}: ${source}`);
    }
    sourceCount += 1;
    const normalizedSource = local.split(sep).join("/");
    if (sources.has(normalizedSource))
      throw new Error(`Duplicate LCOV source: ${normalizedSource}`);
    sources.add(normalizedSource);
    return `SF:${normalizedSource}`;
  });
  if (sourceCount === 0)
    throw new Error(`LCOV report contains no sources: ${path}`);
  validateRecords(normalized, sourceCount, path);
  for (const source of expectedSources) {
    if (!sources.has(source))
      throw new Error(`Missing expected LCOV source in ${path}: ${source}`);
  }
  return normalized;
}

function validateRecords(normalized, sourceCount, path) {
  const records = normalized.trim().split(/end_of_record(?:\r?\n|$)/u);
  if (
    records.pop().trim() ||
    records.length !== sourceCount ||
    records.some(
      (record) =>
        (record.match(/^SF:/gm)?.length ?? 0) !== 1 ||
        !(
          /^DA:\d+,\d+(?:,[^,\r\n]+)?\r?$/m.test(record) ||
          /^LF:0\r?$/m.test(record)
        ),
    )
  ) {
    throw new Error(`Invalid LCOV records: ${path}`);
  }
  for (const record of records) {
    const dataLines = record
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("DA:"));
    if (
      dataLines.some((line) => !/^DA:\d+,\d+(?:,[^,\r\n]+)?$/u.test(line)) ||
      new Set(dataLines.map((line) => line.split(",")[0])).size !==
        dataLines.length
    ) {
      throw new Error(`Invalid LCOV line counters: ${path}`);
    }
    const declared = record.match(/^LF:(\d+)\r?$/m);
    if (declared && Number(declared[1]) !== dataLines.length) {
      throw new Error(`Incomplete LCOV line counters: ${path}`);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.cwd();
  const reports = testWorkspaces(root).map((workspace) => {
    const path = `${workspace.path}/coverage/lcov.info`;
    return { path, content: readFileSync(resolve(root, path), "utf8") };
  });
  const scriptsPath = "coverage/scripts/lcov.info";
  reports.push({
    path: scriptsPath,
    sourceRoot: ".",
    expectedSources: CI_SOURCES,
    content: readFileSync(resolve(root, scriptsPath), "utf8"),
  });
  const output = mergeCoverage(reports, root);
  mkdirSync(resolve(root, "coverage"), { recursive: true });
  writeFileSync(resolve(root, "coverage/lcov.info"), output);
  console.log(
    `Merged ${reports.length - 1} workspace reports and native CI-script coverage`,
  );
}
