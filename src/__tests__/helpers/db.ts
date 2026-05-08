import { PrismaClient } from "@prisma/client";

// Separate instance from the app singleton so tests can control lifecycle
export const db = new PrismaClient();

export async function truncateDomains() {
  await db.domainPricelist.deleteMany();
  await db.domain.deleteMany();
}

export async function truncateAll() {
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
