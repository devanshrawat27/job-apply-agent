import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const projectRoot = process.cwd();
await mkdir(path.join(projectRoot, "data"), { recursive: true });
const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Application" ("id" TEXT NOT NULL PRIMARY KEY, "company" TEXT, "role" TEXT, "sourceUrl" TEXT, "status" TEXT NOT NULL, "reviewHash" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Approval" ("id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "kind" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Approval_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Approval_applicationId_kind_contentHash_key" ON "Approval" ("applicationId", "kind", "contentHash")`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AuditEvent" ("id" TEXT NOT NULL PRIMARY KEY, "applicationId" TEXT NOT NULL, "action" TEXT NOT NULL, "details" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
  console.log("Prisma SQLite schema initialized via generated client.");
} finally { await prisma.$disconnect(); }
