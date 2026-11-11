import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const resolve = createRequire(import.meta.url).resolve;

describe("SHA-256 adapter package exports", () => {
  it.each(["dist/index.js", "package.json"])(
    "does not export the %s subpath",
    (subpath) => {
      expect(() =>
        resolve(`@architecture/iam-email-verification-sha256/${subpath}`),
      ).toThrow(
        expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
      );
    },
  );
});
