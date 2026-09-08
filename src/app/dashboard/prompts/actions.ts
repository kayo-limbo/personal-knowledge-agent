"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createPrompt,
  deletePrompt,
  updatePrompt,
} from "@/lib/services/prompt.service";
import {
  firstPromptValidationError,
  promptInputSchema,
} from "@/lib/validators/prompt";
import { resourceIdSchema } from "@/lib/validators/common";

async function requirePromptUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "GUEST") throw new Error("访客没有管理 Prompt 的权限");
  return session.user.id;
}

function parsePromptForm(formData: FormData) {
  return promptInputSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    isPublic: formData.get("isPublic") === "on",
    favorite: formData.get("favorite") === "on",
  });
}

function promptUrl(kind: "success" | "error", message: string) {
  return `/dashboard/prompts?${kind}=${encodeURIComponent(message)}`;
}

export async function createPromptAction(formData: FormData) {
  let destination = promptUrl("success", "Prompt 已创建");
  try {
    const userId = await requirePromptUser();
    const parsed = parsePromptForm(formData);
    if (!parsed.success) {
      destination = promptUrl("error", firstPromptValidationError(parsed.error));
    } else {
      await createPrompt(userId, parsed.data);
      revalidatePath("/dashboard/prompts");
      revalidatePath("/dashboard");
    }
  } catch (error) {
    destination = promptUrl("error", error instanceof Error ? error.message : "创建 Prompt 失败");
  }
  redirect(destination);
}

export async function updatePromptAction(formData: FormData) {
  let destination = promptUrl("success", "Prompt 已更新");
  try {
    const userId = await requirePromptUser();
    const id = resourceIdSchema.parse(formData.get("id"));
    const parsed = parsePromptForm(formData);
    if (!parsed.success) {
      destination = promptUrl("error", firstPromptValidationError(parsed.error));
    } else {
      await updatePrompt(id, userId, parsed.data);
      revalidatePath("/dashboard/prompts");
    }
  } catch (error) {
    destination = promptUrl("error", error instanceof Error ? error.message : "更新 Prompt 失败");
  }
  redirect(destination);
}

export async function deletePromptAction(formData: FormData) {
  let destination = promptUrl("success", "Prompt 已删除");
  try {
    const userId = await requirePromptUser();
    const id = resourceIdSchema.parse(formData.get("id"));
    await deletePrompt(id, userId);
    revalidatePath("/dashboard/prompts");
    revalidatePath("/dashboard");
  } catch (error) {
    destination = promptUrl("error", error instanceof Error ? error.message : "删除 Prompt 失败");
  }
  redirect(destination);
}
