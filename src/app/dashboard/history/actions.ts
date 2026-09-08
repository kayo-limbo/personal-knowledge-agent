"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  deleteConversation,
  renameConversation,
} from "@/lib/services/conversation.service";
import { conversationTitleSchema } from "@/lib/validators/conversation";
import { resourceIdSchema } from "@/lib/validators/common";

async function requireHistoryUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "GUEST") throw new Error("访客没有管理历史记录的权限");
  return session.user.id;
}

function historyUrl(kind: "success" | "error", message: string) {
  return `/dashboard/history?${kind}=${encodeURIComponent(message)}`;
}

export async function renameConversationAction(formData: FormData) {
  let destination = historyUrl("success", "会话已重命名");
  try {
    const userId = await requireHistoryUser();
    const id = resourceIdSchema.parse(formData.get("id"));
    const parsed = conversationTitleSchema.safeParse(formData.get("title"));
    if (!parsed.success) {
      destination = historyUrl("error", parsed.error.issues[0]?.message ?? "标题格式不正确");
    } else {
      await renameConversation(id, userId, parsed.data);
      revalidatePath("/dashboard/history");
      revalidatePath("/dashboard/chat");
      revalidatePath("/dashboard");
    }
  } catch (error) {
    destination = historyUrl("error", error instanceof Error ? error.message : "重命名失败");
  }
  redirect(destination);
}

export async function deleteConversationAction(formData: FormData) {
  let destination = historyUrl("success", "会话及其消息已删除");
  try {
    const userId = await requireHistoryUser();
    const id = resourceIdSchema.parse(formData.get("id"));
    await deleteConversation(id, userId);
    revalidatePath("/dashboard/history");
    revalidatePath("/dashboard/chat");
    revalidatePath("/dashboard");
  } catch (error) {
    destination = historyUrl("error", error instanceof Error ? error.message : "删除会话失败");
  }
  redirect(destination);
}
