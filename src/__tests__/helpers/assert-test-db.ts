/**
 * Last line of defence against the test suite ever touching a real database.
 *
 * The integration tests TRUNCATE tables. They must only ever run against a
 * throwaway database whose name ends in "_test". This guard is called at
 * module-load time (before any connection is opened) AND again inside every
 * truncate helper, so there is no code path that can wipe a dev/prod DB.
 *
 * If you hit the error below: you almost certainly forgot to start the test DB
 * (`npm run test:db:up`) or your shell exports a DATABASE_URL pointing at a
 * real database. Fix the URL — do NOT relax this check.
 */
export function assertTestDatabase(url: string | undefined): void {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Refusing to run database tests without an explicit test database.",
    );
  }

  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error(`DATABASE_URL is not a valid connection string: ${url}`);
  }

  if (!dbName.endsWith("_test")) {
    throw new Error(
      "\n\n⛔  REFUSING TO RUN TESTS.\n" +
        `   Database "${dbName}" does not end in "_test".\n` +
        "   The test suite truncates tables and must only ever target a disposable test DB.\n" +
        `   DATABASE_URL = ${url}\n\n` +
        "   Start the test database with:  npm run test:db:up\n",
    );
  }
}
