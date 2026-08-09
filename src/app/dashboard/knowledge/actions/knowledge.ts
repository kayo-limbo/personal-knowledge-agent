"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getKnowledgeById,
} from "@/lib/services/knowledge.service";
import type { KnowledgeActionResult } from "@/app/dashboard/knowledge/types";
import {
  firstValidationError,
  knowledgeInputSchema,
  knowledgeUpdateSchema,
} from "@/lib/validators/knowledge";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  // 隐藏菜单不是安全措施；Server Action 仍要单独检查角色。
  if (session.user.role === "GUEST") throw new Error("访客没有管理知识库的权限");
  return session.user.id;
}

export async function createKnowledgeAction(formData: FormData): Promise<KnowledgeActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = knowledgeInputSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
      summary: formData.get("summary") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      source: formData.get("source") ?? undefined,
    });
    if (!parsed.success) return { success: false, error: firstValidationError(parsed.error) };

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
    const parsed = knowledgeUpdateSchema.safeParse({
      title: formData.get("title") ?? undefined,
      content: formData.get("content") ?? undefined,
      summary: formData.get("summary") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      source: formData.get("source") ?? undefined,
    });
    if (!parsed.success) return { success: false, error: firstValidationError(parsed.error) };

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
