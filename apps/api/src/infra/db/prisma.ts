import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function registerPrisma(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient({
    ...(app.config.DATABASE_URL
      ? {
          datasources: {
            db: {
              url: app.config.DATABASE_URL
            }
          }
        }
      : {}),
    log: app.config.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
}
