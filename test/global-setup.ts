import { execSync } from "node:child_process";
import pg from "pg";
import type { TestProject } from "vitest/node";

/**
 * Create the test database if needed and apply all Prisma migrations to it.
 * Runs once before the test files.
 */
export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL for tests is not set (see vitest.config.mts)");
  assertTestDatabase(url);

  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  const quoted = `"${dbName.replace(/"/g, '""')}"`;
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE ${quoted}`);
  // Non-UTC default on purpose: timestamp handling must not depend on the
  // server's time zone (db.ts pins sessions to UTC).
  await client.query(`ALTER DATABASE ${quoted} SET timezone = 'America/New_York'`);
  await client.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

export function assertTestDatabase(url: string) {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${name}": database name must end in _test`);
  }
}
