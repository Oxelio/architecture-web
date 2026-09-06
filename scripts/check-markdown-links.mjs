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
  const files = [];

  async function visit(candidate) {
    const info = await pathStat(candidate);
    if (!info) return;

    if (info.isDirectory()) {
      const entries = await readdir(candidate, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        await visit(resolve(candidate, entry.name));
      }
      return;
    }

    if (info.isFile() && candidate.endsWith(".md")) files.push(candidate);
  }

  for (const sourcePath of sourcePaths) {
    await visit(resolve(repoRoot, sourcePath));
  }

  return files.sort();
}

function extractTargets(markdown) {
  const targets = [];
  let fence = null;

  for (const line of markdown.split(/\r?\n/u)) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      continue;
    }
    if (fence !== null) continue;

    const withoutInlineCode = line.replace(/`+[^`]*`+/gu, "");
    const inlineLink = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/gu;
    let match;
    while ((match = inlineLink.exec(withoutInlineCode)) !== null) {
      targets.push(match[1]);
    }

    const reference = withoutInlineCode.match(
      /^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/u,
    );
    if (reference) targets.push(reference[1]);
  }

  return targets;
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

  for (const source of files) {
    const markdown = await readFile(source, "utf8");
    for (const rawTarget of extractTargets(markdown)) {
      const normalized = normalizeTarget(rawTarget);
      if (normalized.ignored) continue;
      linksChecked += 1;

      const sourceLabel = toPosix(relative(root, source));
      if (normalized.invalidEncoding) {
        errors.push(
          `${sourceLabel}: invalid URI encoding in link target ${rawTarget}`,
        );
        continue;
      }

      const targetPath = normalized.path.startsWith("/")
        ? resolve(root, `.${normalized.path}`)
        : resolve(dirname(source), normalized.path);

      if (!isWithin(root, targetPath)) {
        errors.push(`${sourceLabel}: link escapes repository root: ${rawTarget}`);
        continue;
      }

      const targetLabel = toPosix(relative(root, targetPath));
      if (
        targetLabel === "docs/method" ||
        targetLabel.startsWith("docs/method/")
      ) {
        errors.push(
          `${sourceLabel}: removed legacy Method path is forbidden: ${rawTarget}`,
        );
        continue;
      }

      const targetInfo = await pathStat(targetPath);
      if (!targetInfo) {
        if (
          targetLabel === "external/software-engineering-method" ||
          targetLabel.startsWith("external/software-engineering-method/")
        ) {
          errors.push(
            `${sourceLabel}: Method submodule target is unavailable: ${rawTarget} ` +
              "(initialize external/software-engineering-method before validation)",
          );
        } else {
          errors.push(
            `${sourceLabel}: missing repository-relative target: ${rawTarget}`,
          );
        }
      }
    }
  }

  return { errors, filesChecked: files.length, linksChecked };
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
