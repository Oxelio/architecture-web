import { describe, expect, it } from "vitest";

import fullConfig from "./full.mjs";
import nodeConfig from "./node.mjs";
import reactViteConfig from "./react-vite.mjs";

describe("eslint configuration presets", () => {
  it("exports usable non-empty configuration arrays", () => {
    expect(nodeConfig.length).toBeGreaterThan(0);
    expect(reactViteConfig.length).toBeGreaterThan(0);
    expect(fullConfig.length).toBeGreaterThan(0);
  });
});
