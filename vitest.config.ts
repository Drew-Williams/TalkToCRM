import path from "node:path";
import { defineConfig } from "vitest/config";

// Deliberately excludes the crx() plugin from vite.config.ts — vitest just
// needs plain TS/React transform + the "@" alias to run the pure
// deal-detection unit tests. No chrome.* mocking needed since hubspot.ts and
// pipedrive.ts are plain URL-parsing functions with no chrome dependency.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
