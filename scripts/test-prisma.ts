import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw<Array<{ current_database: string; current_user: string }>>`
      SELECT current_database(), current_user;
    `;
    console.log("PRISMA READ-ONLY CONNECTIVITY CHECK SUCCESS:", result);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    console.error("PRISMA CONNECTIVITY ERROR:", error.code, error.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
