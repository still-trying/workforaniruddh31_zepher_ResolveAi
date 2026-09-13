import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
    // TESTING.md runs these against one real Supabase database, so test files must not run in
    // parallel: they mutate shared seed rows and would otherwise race each other.
    fileParallelism: false,
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
