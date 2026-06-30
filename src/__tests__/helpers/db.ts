import { PrismaClient } from "@prisma/client";
import { assertTestDatabase } from "./assert-test-db";

// Hard stop BEFORE a connection is ever opened: if DATABASE_URL does not point
// at a "*_test" database, this throws and no PrismaClient is created.
assertTestDatabase(process.env.DATABASE_URL);

// Separate instance from the app singleton so tests can control lifecycle
export const db = new PrismaClient();

export async function truncateDomains() {
  assertTestDatabase(process.env.DATABASE_URL);
  await db.domainPricelist.deleteMany();
  await db.domain.deleteMany();
}

export async function truncateAll() {
  assertTestDatabase(process.env.DATABASE_URL);
  await db.domainPricelist.deleteMany();
  await db.apiKeyLog.deleteMany();
  await db.domain.deleteMany();
  await db.pricelist.deleteMany();
  await db.apiKey.deleteMany();
  await db.webhookUrl.deleteMany();
  await db.apiLog.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.appSetting.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
}
