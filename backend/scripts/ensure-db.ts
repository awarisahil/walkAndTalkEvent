import "dotenv/config";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
const targetDb = url.pathname.replace(/^\//, "").split("?")[0];

if (!targetDb) {
  console.error("DATABASE_URL has no database name");
  process.exit(1);
}

url.pathname = "/postgres";
url.search = "";

const admin = new pg.Client({ connectionString: url.toString() });

async function main() {
  try {
    await admin.connect();
    const { rows } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb],
    );
    if (rows.length > 0) {
      console.log(`Database "${targetDb}" already exists`);
    } else {
      await admin.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`Database "${targetDb}" created`);
    }
  } catch (err) {
    console.error(
      "Failed to ensure database:",
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 1;
  } finally {
    await admin.end();
  }
}

void main();
