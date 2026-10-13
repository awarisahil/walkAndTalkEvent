/**
 * Creates the isolated test database "walkandtalk_test" (if absent) and
 * applies all migrations to it. The dev DATABASE_URL is loaded via
 * dotenv and only its database name is swapped — the URL itself is
 * never printed or written anywhere.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";

const TEST_DB_NAME = "walkandtalk_test";

function testDatabaseUrl(): string {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error("DATABASE_URL is not defined");
  }
  const url = new URL(devUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };

console.log(`Ensuring test database "${TEST_DB_NAME}" exists...`);
execFileSync("npx", ["tsx", "scripts/ensure-db.ts"], {
  env,
  stdio: ["ignore", "inherit", "inherit"],
});

console.log("Applying migrations to test database...");
execFileSync("npx", ["prisma", "migrate", "deploy"], {
  env,
  stdio: ["ignore", "inherit", "inherit"],
});

console.log("Test database is ready.");
