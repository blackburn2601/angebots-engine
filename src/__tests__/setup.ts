import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertTestDatabase } from "./helpers/assert-test-db";

// Runs once per test worker, BEFORE any test module (and therefore before the
// Prisma client in helpers/db.ts) is imported.
//
// If DATABASE_URL is already set by the environment (e.g. CI provides a
// dedicated *_test DB), we keep it. Otherwise we load it from .env.test so
// local runs target the disposable test DB on port 5433 — NOT the dev DB that
// Prisma would otherwise auto-load from .env.
if (!process.env.DATABASE_URL) {
  let contents: string;
  try {
    contents = readFileSync(resolve(process.cwd(), ".env.test"), "utf8");
  } catch {
    throw new Error(
      ".env.test not found. Tests need a dedicated test database.\n" +
        "Start it with:  npm run test:db:up",
    );
  }
  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Fail loudly here too, so a misconfigured run never reaches a real database.
assertTestDatabase(process.env.DATABASE_URL);
