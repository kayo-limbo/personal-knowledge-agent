import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  ChatBootstrap,
  ChatConversation,
  ChatMessage,
} from "@/app/dashboard/chat/types";

const MAX_BOOTSTRAP_CONVERSATIONS = 20;
const MAX_CONTEXT_MESSAGES = 30;
// 中文通常比英文消耗更多 token，因此再用字符预算做一道保守的成本保护。
const MAX_CONTEXT_CHARACTERS = 24_000;

function toConversation(item: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}): ChatConversation {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toMessage(item: {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}): ChatMessage {
  // 数据库暂时使用 String 保存 role；读取时只允许领域模型支持的三种角色。
  const role = item.role === "assistant" || item.role === "system" ? item.role : "user";
  return { ...item, role, createdAt: item.createdAt.toISOString() };
}

/**
 * 首屏只取最近 20 个会话。限制数量既能减少数据库读取，也能控制传给浏览器的数据体积。
 */
export async function getChatBootstrap(userId: string): Promise<ChatBootstrap> {
  const rows = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: MAX_BOOTSTRAP_CONVERSATIONS,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const conversations = rows.map(toConversation);
  const messagesByConversation = Object.fromEntries(
    // 如果服务器曾在流式回答中途退出，忽略可能遗留的空 assistant 占位消息。
    rows.map((row) => [
      row.id,
      row.messages.filter((message) => message.content.trim()).map(toMessage),
    ])
  );

  return { conversations, messagesByConversation };
}

/** 根据第一条问题生成一个简短标题，后面可以再换成模型自动总结标题。 */
function createTitle(content: string): string {
  const firstLine = content.replace(/\s+/g, " ").trim();
  return firstLine.length > 36 ? `${firstLine.slice(0, 36)}…` : firstLine;
}

/**
 * 复用会话前必须同时检查 id 和 userId，防止用户读取或写入别人的会话。
 */
export async function getOrCreateConversation(
  userId: string,
  conversationId: string | undefined,
  firstMessage: string
): Promise<ChatConversation> {
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    if (!existing) throw new Error("会话不存在或无权限");
    return toConversation(existing);
  }

  const created = await prisma.conversation.create({
    data: { userId, title: createTitle(firstMessage) || "新对话" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return toConversation(created);
}

export async function createConversationMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const message = await prisma.message.create({
    data: { conversationId, role, content },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  // Message 是子表，新增它不会自动触发 Conversation.updatedAt，所以这里手动“触碰”会话。
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  return toMessage(message);
}

/** 只把最近 30 条有效消息发给模型，避免上下文无限增长导致费用失控。 */
export async function getModelContext(conversationId: string) {
  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      role: { in: ["user", "assistant"] },
      content: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CONTEXT_MESSAGES,
    select: { role: true, content: true },
  });

  let usedCharacters = 0;
  const selected = [];
  for (const item of rows) {
    const remaining = MAX_CONTEXT_CHARACTERS - usedCharacters;
    if (remaining <= 0) break;

    // rows 是从新到旧；预算不够时保留较老消息的末尾，并始终优先保留最新消息。
    const content = item.content.length > remaining ? item.content.slice(-remaining) : item.content;
    selected.push({ ...item, content });
    usedCharacters += content.length;
  }

  const chronological = selected.reverse();
  // 截断后可能以 assistant 开头；Anthropic 兼容接口要求对话从 user 消息开始。
  while (chronological[0]?.role === "assistant") chronological.shift();

  return chronological.map((item) => ({
    role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: item.content,
  }));
}

export async function completeAssistantMessage(messageId: string, content: string) {
  await prisma.message.update({ where: { id: messageId }, data: { content } });
}

export async function removeMessage(messageId: string) {
  await prisma.message.delete({ where: { id: messageId } }).catch(() => undefined);
}
