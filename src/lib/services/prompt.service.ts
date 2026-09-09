import "server-only";

import { prisma } from "@/lib/prisma";

export interface PromptInput {
  title: string;
  content: string;
  isPublic: boolean;
  favorite: boolean;
}

export class ChatPromptError extends Error {}

const promptSelect = {
  id: true,
  title: true,
  content: true,
  isPublic: true,
  favorite: true,
  createdAt: true,
} as const;

/** Prompt 管理只返回当前用户自己的记录；公开标记不等于允许他人修改。 */
export async function listPrompts(userId: string) {
  return prisma.prompt.findMany({
    where: { userId },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    select: promptSelect,
  });
}

/** 只发送选择器需要的字段，模板正文始终由服务器读取。 */
export async function listChatPrompts(userId: string) {
  return prisma.prompt.findMany({
    where: { userId }, orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true },
  });
}

export async function resolveChatPrompt(userId: string, conversationId: string | undefined, requestedId: string | null | undefined, canUsePrompt: boolean) {
  let promptId = requestedId ?? null;
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId }, select: { promptId: true },
    });
    if (!conversation) throw new ChatPromptError("会话不存在或无权限");
    if (requestedId !== undefined && requestedId !== conversation.promptId) {
      throw new ChatPromptError("已有会话不能更换 Prompt，请新建会话");
    }
    promptId = conversation.promptId;
  }
  if (!promptId) return { promptId: null, content: "" };
  if (!canUsePrompt) throw new ChatPromptError("当前角色不能使用自定义 Prompt，请新建默认会话");
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, userId }, select: { content: true } });
  if (!prompt) throw new ChatPromptError("Prompt 不存在或无权限，请刷新页面");
  return { promptId, content: prompt.content };
}

export async function createPrompt(userId: string, input: PromptInput) {
  return prisma.prompt.create({
    data: { ...input, userId },
    select: promptSelect,
  });
}

export async function updatePrompt(id: string, userId: string, input: PromptInput) {
  const result = await prisma.prompt.updateMany({
    where: { id, userId },
    data: input,
  });
  if (result.count === 0) throw new Error("Prompt 不存在或无权限");
}

export async function deletePrompt(id: string, userId: string) {
  const prompt = await prisma.prompt.findFirst({ where: { id, userId }, select: { id: true } });
  if (!prompt) throw new Error("Prompt 不存在或无权限");
  await prisma.$transaction([
    prisma.conversation.updateMany({ where: { promptId: id, userId }, data: { promptId: null } }),
    prisma.prompt.delete({ where: { id } }),
  ]);
}
