import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import fg from "fast-glob";

const HEADER_REGEX = /^\/\/ @file .+$/;

const mode = process.argv[2] ?? "--all";

function getStagedFiles() {
  return execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

async function getAllFiles() {
  return fg(["**/*.ts", "**/*.tsx"], {
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.git/**",
      "**/.next/**",
      "**/build/**",
    ],
    onlyFiles: true,
    dot: false,
  });
}

const files = mode === "--staged" ? getStagedFiles() : await getAllFiles();

for (const file of files) {
  if (
    file.includes("/node_modules/") ||
    file.includes("\\node_modules\\") ||
    file.includes("/dist/") ||
    file.includes("\\dist\\")
  ) {
    continue;
  }

  const relativePath = file.replaceAll("\\", "/");
  const header = `// @file ${relativePath}`;

  const content = readFileSync(file, "utf8");

  const lines = content.split("\n");

  let changed = false;

  if (HEADER_REGEX.test(lines[0])) {
    if (lines[0] !== header) {
      lines[0] = header;
      changed = true;
    }
  } else {
    lines.unshift(header);
    changed = true;
  }

  if (changed) {
    writeFileSync(file, lines.join("\n"));
    console.log(`Updated ${file}`);
  }
}

if (mode === "--staged") {
  for (const file of files) {
    execSync(`git add -- "${file}"`);
  }
}
