import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { testWorkspaces } from "./run-workspace-tests.mjs";

// Vitest's SF entries are relative to each workspace, not to the scanner root.
export function mergeCoverage(reports, root) {
  if (reports.length === 0) throw new Error("No workspace LCOV reports found");
  const output = reports.map(({ path, content }) => {
    const workspace = dirname(dirname(resolve(root, path)));
    let sourceCount = 0;
    const normalized = content.replace(/^SF:(.+)\r?$/gm, (_, source) => {
      const absolute = resolve(workspace, source.trim());
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
      return `SF:${local.split(sep).join("/")}`;
    });
    if (sourceCount === 0)
      throw new Error(`LCOV report contains no sources: ${path}`);
    const records = normalized.trim().split(/end_of_record(?:\r?\n|$)/u);
    if (
      records.pop().trim() ||
      records.length !== sourceCount ||
      records.some(
        (record) =>
          (record.match(/^SF:/gm)?.length ?? 0) !== 1 ||
          !(
            /^DA:[0-9]+,[0-9]+(?:,[^,\r\n]+)?\r?$/m.test(record) ||
            /^LF:0\r?$/m.test(record)
          ),
      )
    ) {
      throw new Error(`Invalid LCOV records: ${path}`);
    }
    return normalized;
  });
  return output.join("\n");
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
  const output = mergeCoverage(reports, root);
  mkdirSync(resolve(root, "coverage"), { recursive: true });
  writeFileSync(resolve(root, "coverage/lcov.info"), output);
  console.log(`Merged ${reports.length} workspace coverage reports`);
}
