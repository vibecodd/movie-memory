import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { defineConfig } from "vitest/config";

// Tests run against a separate database: TEST_DATABASE_URL, or DATABASE_URL
// with "_test" appended to the database name (e.g. mydb -> mydb_test).
try {
  loadEnvFile(".env");
} catch {
  // No .env (e.g. CI): rely on the real environment.
}

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL or TEST_DATABASE_URL for tests");
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  return url.toString();
}

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
      // `server-only` throws outside React Server Components; tests are server code.
      { find: "server-only", replacement: fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      OPENAI_API_KEY: "test-key-never-used",
    },
    // All test files share one database.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
