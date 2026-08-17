import "server-only";
import { PrismaClient } from "@prisma/client";
import { serverEnvironment } from "@/lib/env/server";

const globalPrisma = globalThis as typeof globalThis & {
  __myluxcardsPrisma?: PrismaClient;
  __myluxcardsPrismaUrl?: string;
};

function createPrismaClient() {
  const environment = serverEnvironment();
  return new PrismaClient({
    datasourceUrl: environment.DATABASE_URL,
    log: environment.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalPrisma.__myluxcardsPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalPrisma.__myluxcardsPrisma = prisma;
}

