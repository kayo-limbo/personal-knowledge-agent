import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  assertChatQuotaAvailable,
  getChatQuotaConfig,
  getUtcQuotaDate,
  type ChatQuotaConfig,
} from "@/lib/chat-quota";
import { prisma } from "@/lib/prisma";

const GLOBAL_SCOPE = "global";
const GLOBAL_SUBJECT = "all";
const USER_SCOPE = "user";
const MAX_TRANSACTION_ATTEMPTS = 3;

interface ReserveChatQuotaOptions {
  now?: Date;
  config?: ChatQuotaConfig;
}

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

/**
 * 在调用 DeepSeek 前同时占用用户与全站配额。
 * Serializable 事务让并发请求不能通过“先读后加”的竞态一起越过上限。
 */
export async function reserveDailyChatQuota(
  userId: string,
  options: ReserveChatQuotaOptions = {}
): Promise<void> {
  const now = options.now ?? new Date();
  const usageDate = getUtcQuotaDate(now);
  const config = options.config ?? getChatQuotaConfig();

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      await prisma.$transaction(
        async (transaction) => {
          const rows = await transaction.chatQuota.findMany({
            where: {
              usageDate,
              OR: [
                { scope: GLOBAL_SCOPE, subjectId: GLOBAL_SUBJECT },
                { scope: USER_SCOPE, subjectId: userId },
              ],
            },
            select: { scope: true, subjectId: true, requestCount: true },
          });
          const globalCount =
            rows.find(
              (row) => row.scope === GLOBAL_SCOPE && row.subjectId === GLOBAL_SUBJECT
            )?.requestCount ?? 0;
          const userCount =
            rows.find((row) => row.scope === USER_SCOPE && row.subjectId === userId)
              ?.requestCount ?? 0;

          assertChatQuotaAvailable(userCount, globalCount, config, now);

          // 所有事务按相同顺序写两个桶，降低并发时的死锁概率。
          for (const bucket of [
            { scope: GLOBAL_SCOPE, subjectId: GLOBAL_SUBJECT },
            { scope: USER_SCOPE, subjectId: userId },
          ]) {
            await transaction.chatQuota.upsert({
              where: {
                scope_subjectId_usageDate: { ...bucket, usageDate },
              },
              create: { ...bucket, usageDate, requestCount: 1 },
              update: { requestCount: { increment: 1 } },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return;
    } catch (error: unknown) {
      if (!isSerializationConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }
}
