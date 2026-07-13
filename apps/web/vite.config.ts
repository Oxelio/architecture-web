// @file apps/web/vite.config.ts

import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router-dom")) return "vendor-react-router";
            if (
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/query-core")
            )
              return "vendor-react-query";
            if (id.includes("framer-motion")) return "vendor-framer-motion";
            if (id.includes("react")) return "vendor-react";
            if (id.includes("clsx") || id.includes("tailwind-merge"))
              return "vendor-helpers";
            return "vendor";
          }
        },
      },
    },
  },
});
