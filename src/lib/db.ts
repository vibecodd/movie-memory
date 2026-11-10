import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse one client across hot reloads in dev to avoid exhausting DB connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Prisma sends DateTime values as UTC text without an offset; Postgres
    // reads such text in the session time zone. Pin sessions to UTC so
    // timestamptz values are stored as the instant Prisma meant, whatever
    // the server's default TimeZone is.
    options: "-c TimeZone=UTC",
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
