import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/stubs/empty.ts") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: "forks",
    env: { DAWATI_TEST: "1", APP_SECRET: "test-secret-0123456789abcdef0123456789abcdef" },
  },
});
