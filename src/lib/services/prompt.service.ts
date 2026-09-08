import "server-only";

import { prisma } from "@/lib/prisma";

export interface PromptInput {
  title: string;
  content: string;
  isPublic: boolean;
  favorite: boolean;
}

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
