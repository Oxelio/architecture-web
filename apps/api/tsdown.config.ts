// @file apps/api/tsdown.config.ts

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],

  format: ["esm"],

  platform: "node",

  target: "node26",

  outDir: "dist",

  clean: true,

  sourcemap: true,

  treeshake: true,

  dts: false,

  deps: {
    neverBundle: ["pg", "ioredis"],
  },
});
