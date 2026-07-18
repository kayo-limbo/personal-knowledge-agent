"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getKnowledgeById,
} from "@/lib/services/knowledge.service";
import {
  KNOWLEDGE_TITLE_MAX_LENGTH,
  KNOWLEDGE_CONTENT_MAX_LENGTH,
} from "@/app/dashboard/knowledge/constants";
import type { KnowledgeActionResult } from "@/app/dashboard/knowledge/types";

const knowledgeSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(KNOWLEDGE_TITLE_MAX_LENGTH),
  content: z.string().min(1, "内容不能为空").max(KNOWLEDGE_CONTENT_MAX_LENGTH),
  summary: z.string().optional(),
  tags: z.string().optional(),
  source: z.enum(["conversation", "upload", "manual"]).optional(),
});

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  return session.user.id;
}

export async function createKnowledgeAction(formData: FormData): Promise<KnowledgeActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = knowledgeSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
      summary: formData.get("summary") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      source: formData.get("source") ?? undefined,
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const doc = await createKnowledge(userId, parsed.data);
    revalidatePath("/dashboard/knowledge");
    return { success: true, data: doc };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "创建失败" };
  }
}

export async function updateKnowledgeAction(id: string, formData: FormData): Promise<KnowledgeActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = knowledgeSchema.partial().safeParse({
      title: formData.get("title") ?? undefined,
      content: formData.get("content") ?? undefined,
      summary: formData.get("summary") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      source: formData.get("source") ?? undefined,
    });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const doc = await updateKnowledge(id, userId, parsed.data);
    revalidatePath("/dashboard/knowledge");
    return { success: true, data: doc };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "更新失败" };
  }
}

export async function deleteKnowledgeAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await requireUserId();
    await deleteKnowledge(id, userId);
    revalidatePath("/dashboard/knowledge");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "删除失败" };
  }
}

export async function getKnowledgeDetailAction(id: string): Promise<KnowledgeActionResult> {
  try {
    const userId = await requireUserId();
    const doc = await getKnowledgeById(id, userId);
    if (!doc) return { success: false, error: "知识条目不存在或无权限" };
    return { success: true, data: doc };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "获取详情失败" };
  }
}