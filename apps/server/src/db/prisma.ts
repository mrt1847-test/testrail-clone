import { PrismaClient } from "@prisma/client";

export { PrismaClient };

let prismaSingleton: PrismaClient | null = null;

export function getPrismaClient() {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}
