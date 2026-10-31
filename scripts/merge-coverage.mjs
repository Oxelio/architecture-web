import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Vitest's SF entries are relative to each workspace, not to the scanner root.
export function mergeCoverage(reports, root) {
  if (reports.length === 0) throw new Error("No workspace LCOV reports found");
  let sourceCount = 0;
  const output = reports.map(({ path, content }) => {
    const workspace = dirname(dirname(resolve(root, path)));
    return content.replace(/^SF:(.+)\r?$/gm, (_, source) => {
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
  });
  if (sourceCount === 0) throw new Error("LCOV reports contain no sources");
  return output.join("\n");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.cwd();
  const reports = globSync(
    ["apps/**/coverage/lcov.info", "packages/**/coverage/lcov.info"],
    { cwd: root, exclude: ["**/node_modules/**", "**/dist/**"] },
  )
    .sort()
    .map((path) => ({
      path,
      content: readFileSync(resolve(root, path), "utf8"),
    }));
  const output = mergeCoverage(reports, root);
  mkdirSync(resolve(root, "coverage"), { recursive: true });
  writeFileSync(resolve(root, "coverage/lcov.info"), output);
  console.log(`Merged ${reports.length} workspace coverage reports`);
}
