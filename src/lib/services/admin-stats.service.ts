import "server-only";

import { getChatQuotaConfig, getUtcQuotaDate } from "@/lib/chat-quota";
import { prisma } from "@/lib/prisma";

export async function getSystemStats(now = new Date()) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const usageDate = getUtcQuotaDate(now);

  const [
    users,
    admins,
    standardUsers,
    guests,
    knowledge,
    prompts,
    conversations,
    messages,
    newUsersLast7Days,
    activeConversationsLast7Days,
    activeChatUsersToday,
    globalQuota,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "GUEST" } }),
    prisma.knowledgeDoc.count(),
    prisma.prompt.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.conversation.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.chatQuota.count({ where: { scope: "user", usageDate, requestCount: { gt: 0 } } }),
    prisma.chatQuota.findUnique({
      where: {
        scope_subjectId_usageDate: { scope: "global", subjectId: "all", usageDate },
      },
      select: { requestCount: true },
    }),
  ]);

  const quotaConfig = getChatQuotaConfig();
  return {
    totals: { users, knowledge, prompts, conversations, messages },
    roles: { admins, users: standardUsers, guests },
    activity: {
      newUsersLast7Days,
      activeConversationsLast7Days,
      activeChatUsersToday,
      chatRequestsToday: globalQuota?.requestCount ?? 0,
      globalChatLimit: quotaConfig.globalLimit,
    },
  };
}
