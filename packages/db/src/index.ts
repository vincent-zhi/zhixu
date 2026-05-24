import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create PrismaClient");
  }

  prisma ??= createPrismaClient(connectionString);
  return prisma;
}

export { PrismaProjectStore, NotFoundError } from "./prisma-project-store.js";
export type { ProjectStore } from "./prisma-project-store.js";
