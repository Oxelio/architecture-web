import { execFile } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

// The protected job prepares a clean, data-only candidate checkout and
// verifies source and scanner distribution digests before calling this port.
// Build/coverage collection runs separately with no analysis credential.
export function createProtectedSonarScanner(input: {
  readonly executable: string;
  readonly candidateDirectory: string;
  readonly privateTemporaryRoot: string;
  readonly analysisToken: string;
}) {
  if (
    ![
      input.executable,
      input.candidateDirectory,
      input.privateTemporaryRoot,
    ].every(isAbsolute) ||
    !input.analysisToken.trim()
  ) {
    throw new Error("SONAR_SCANNER_CONFIGURATION_INVALID");
  }
  return async (properties: Readonly<Record<string, string>>) => {
    const directory = await mkdtemp(
      join(input.privateTemporaryRoot, "protected-sonar-"),
    );
    const settings = join(directory, "trusted.properties");
    const report = join(directory, "report-task.txt");
    try {
      const entries = Object.entries(properties);
      if (
        entries.some(
          ([key, value]) =>
            !/^sonar\.[a-zA-Z.]+$/u.test(key) || /[\r\n\\]/u.test(value),
        )
      ) {
        throw new Error("SONAR_SCANNER_SETTINGS_INVALID");
      }
      await writeFile(
        settings,
        entries.map(([key, value]) => `${key}=${value}`).join("\n"),
        { mode: 0o600, flag: "wx" },
      );
      await execute(
        input.executable,
        [
          `-Dproject.settings=${settings}`,
          `-Dsonar.scanner.metadataFilePath=${report}`,
          `-Dsonar.working.directory=${join(directory, "work")}`,
        ],
        {
          cwd: input.candidateDirectory,
          env: {
            PATH: process.env["PATH"],
            JAVA_HOME: process.env["JAVA_HOME"],
            SONAR_USER_HOME: join(directory, "scanner"),
            SONAR_TOKEN: input.analysisToken,
          },
          windowsHide: true,
          maxBuffer: 1024 * 1024,
          timeout: 10 * 60 * 1000,
        },
      );
      const metadata = await lstat(report);
      if (!metadata.isFile() || metadata.size > 8192) {
        throw new Error("SONAR_SCANNER_REPORT_INVALID");
      }
      return await readFile(report, "utf8");
    } catch {
      throw new Error("SONAR_SCANNER_OUTCOME_UNVERIFIED");
    } finally {
      // The job uses a disposable runner for scanner state/cache. Remove
      // the two known receipt files promptly without traversing source data.
      await Promise.allSettled([unlink(report), unlink(settings)]);
      await rmdir(directory).catch(() => undefined);
    }
  };
}
