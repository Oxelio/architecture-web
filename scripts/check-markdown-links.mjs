#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_SOURCE_PATHS = ["README.md", "AGENTS.md", "docs"];

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}

async function pathStat(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function collectMarkdownFiles(
  repoRoot,
  sourcePaths = DEFAULT_SOURCE_PATHS,
) {
  async function visit(candidate) {
    const info = await pathStat(candidate);
    if (!info) return [];

    if (info.isDirectory()) {
      const entries = await readdir(candidate, { withFileTypes: true });
      const nested = await Promise.allSettled(
        entries
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .map((entry) => visit(resolve(candidate, entry.name))),
      );
      return collectedFiles(nested);
    }

    return info.isFile() && candidate.endsWith(".md") ? [candidate] : [];
  }

  const groups = await Promise.allSettled(
    sourcePaths.map((sourcePath) => visit(resolve(repoRoot, sourcePath))),
  );
  // Preserve default UTF-16 ordering, independent of filesystem completion order.
  return collectedFiles(groups).sort((a, b) => Number(a > b) - Number(a < b));
}

function collectedFiles(results) {
  return results.flatMap((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}

function fenceMarker(line) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("```")) return "`";
  if (trimmed.startsWith("~~~")) return "~";
  return null;
}

export function extractTargets(markdown) {
  const targets = [];
  let fence = null;

  for (const line of markdown.split(/\r?\n/u)) {
    const marker = fenceMarker(line);
    if (marker) {
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      continue;
    }
    if (fence !== null) continue;

    const withoutInlineCode = line.replace(/`+[^`]*`+/gu, "");
    for (const target of inlineTargets(withoutInlineCode)) targets.push(target);

    const reference = withoutInlineCode.match(
      /^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/u,
    );
    if (reference) targets.push(reference[1]);
  }

  return targets;
}

function inlineTargets(line) {
  const targets = [];
  const angle = { end: -2, closing: undefined };
  let labelOpen = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "[") {
      labelOpen = true;
      continue;
    }
    if (line[index] !== "]" || !labelOpen) continue;
    labelOpen = false;
    if (line[index + 1] !== "(") continue;
    const closing = line.indexOf(")", index + 2);
    if (closing === -1) break;
    const target = inlineTarget(line, index + 2, closing, angle);
    if (target) {
      targets.push(line.slice(target.start, target.end));
      index = target.closing;
    }
  }
  return targets;
}

function inlineTarget(line, start, closing, angle) {
  while (/\s/u.test(line[start] ?? "")) start += 1;
  if (start === closing) return null;
  const bracketed = angleTarget(line, start, angle);
  if (bracketed) return { start, ...bracketed };
  let end = start;
  while (end < closing && !/\s/u.test(line[end])) end += 1;
  return { start, end, closing };
}

function angleTarget(line, start, angle) {
  if (line[start] !== "<") return null;
  // Reuse lookahead until the cursor passes it. Malformed links must not scan
  // the same remaining suffix for every opening bracket or angle bracket.
  if (angle.end < start && angle.end !== -1) {
    angle.end = line.indexOf(">", start + 1);
    angle.closing = undefined;
  }
  if (angle.end <= start + 1) return null;
  const end = angle.end + 1;
  if (line[end] === ")") return { end, closing: end };
  if (!/\s/u.test(line[end] ?? "")) return null;
  if (angle.closing === undefined) angle.closing = line.indexOf(")", end);
  return angle.closing === -1 ? null : { end, closing: angle.closing };
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1);
  }

  if (
    target === "" ||
    target.startsWith("#") ||
    target.startsWith("//") ||
    /^(?:https?:|mailto:|tel:|data:)/iu.test(target)
  ) {
    return { ignored: true };
  }

  const pathOnly = target.split(/[?#]/u, 1)[0];
  if (!pathOnly) return { ignored: true };

  try {
    return { ignored: false, path: decodeURIComponent(pathOnly) };
  } catch {
    return { ignored: false, invalidEncoding: true, path: pathOnly };
  }
}

export async function validateMarkdownLinks({
  repoRoot = DEFAULT_REPO_ROOT,
  sourcePaths = DEFAULT_SOURCE_PATHS,
} = {}) {
  const root = resolve(repoRoot);
  const files = await collectMarkdownFiles(root, sourcePaths);
  const errors = [];
  let linksChecked = 0;

  const results = await Promise.allSettled(
    files.map(async (source) => {
      const markdown = await readFile(source, "utf8");
      return Promise.allSettled(
        extractTargets(markdown).map((rawTarget) =>
          validateTarget(root, source, rawTarget),
        ),
      );
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    for (const target of result.value) {
      if (target.status === "rejected") throw target.reason;
      if (!target.value.checked) continue;
      linksChecked += 1;
      if (target.value.error) errors.push(target.value.error);
    }
  }
  return { errors, filesChecked: files.length, linksChecked };
}

async function validateTarget(root, source, rawTarget) {
  const normalized = normalizeTarget(rawTarget);
  if (normalized.ignored) return { checked: false };

  const sourceLabel = toPosix(relative(root, source));
  if (normalized.invalidEncoding) {
    return {
      checked: true,
      error: `${sourceLabel}: invalid URI encoding in link target ${rawTarget}`,
    };
  }

  const targetPath = normalized.path.startsWith("/")
    ? resolve(root, `.${normalized.path}`)
    : resolve(dirname(source), normalized.path);

  if (!isWithin(root, targetPath)) {
    return {
      checked: true,
      error: `${sourceLabel}: link escapes repository root: ${rawTarget}`,
    };
  }

  const targetLabel = toPosix(relative(root, targetPath));
  if (targetLabel === "docs/method" || targetLabel.startsWith("docs/method/")) {
    return {
      checked: true,
      error: `${sourceLabel}: removed legacy Method path is forbidden: ${rawTarget}`,
    };
  }

  const targetInfo = await pathStat(targetPath);
  if (!targetInfo) {
    if (
      targetLabel === "external/software-engineering-method" ||
      targetLabel.startsWith("external/software-engineering-method/")
    ) {
      return {
        checked: true,
        error:
          `${sourceLabel}: Method submodule target is unavailable: ${rawTarget} ` +
          "(initialize external/software-engineering-method before validation)",
      };
    } else {
      return {
        checked: true,
        error: `${sourceLabel}: missing repository-relative target: ${rawTarget}`,
      };
    }
  }
  return { checked: true };
}

async function main() {
  const result = await validateMarkdownLinks();
  if (result.errors.length > 0) {
    console.error(
      `Markdown link validation failed (${result.errors.length} error(s)):`,
    );
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Markdown link validation passed: ${result.filesChecked} file(s), ${result.linksChecked} local target(s).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
