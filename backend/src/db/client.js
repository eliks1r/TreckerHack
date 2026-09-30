import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createDatabase(databaseUrl) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
