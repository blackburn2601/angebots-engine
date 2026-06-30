// Runs automatically before `npm test` (as the "pretest" script).
//
// Locally: starts the disposable test DB (docker-compose.test.yml) and applies
// migrations to it. In CI ($CI is set) it does nothing — CI provisions its own
// *_test service container and runs migrations as separate pipeline steps.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

if (process.env.CI) {
  console.log("[ensure-test-db] CI detected — skipping local test DB setup.");
  process.exit(0);
}

// Read the test DATABASE_URL from .env.test (single source of truth).
const envTest = readFileSync(resolve(process.cwd(), ".env.test"), "utf8");
const match = envTest.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
if (!match) {
  console.error("[ensure-test-db] DATABASE_URL not found in .env.test");
  process.exit(1);
}
const DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...opts });

console.log("[ensure-test-db] Starting disposable test database (port 5433)…");
run("docker", ["compose", "-f", "docker-compose.test.yml", "up", "-d", "--wait"]);

console.log("[ensure-test-db] Applying migrations to the test database…");
run("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL } });

console.log("[ensure-test-db] Test database ready.");
