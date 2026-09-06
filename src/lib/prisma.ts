import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("缺少 DATABASE_URL，请配置 PostgreSQL 连接字符串");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL 必须使用 postgresql:// 或 postgres:// 协议");
  }
  return databaseUrl;
}

function createPrismaClient(): PrismaClient {
  const isVercel = process.env.VERCEL === "1";
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
    // Neon Free 可能从休眠中冷启动，连接等待时间要覆盖这段唤醒延迟。
    connectionTimeoutMillis: 10_000,
    // 每个 Vercel 实例只保留一个客户端连接，再由 Neon PgBouncer 汇聚；
    // Docker/本地是长生命周期进程，继续使用原来的 10 连接池。
    idleTimeoutMillis: isVercel ? 10_000 : 30_000,
    max: isVercel ? 1 : 10,
  });
  return new PrismaClient({ adapter });
}

// Next.js 开发热更新会重复加载模块；把实例放到 globalThis 可避免创建多个连接池。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
