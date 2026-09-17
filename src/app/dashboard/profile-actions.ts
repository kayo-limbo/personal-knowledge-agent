"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/personalization";
import { revalidatePath } from "next/cache";

export async function saveProfile(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "登录已过期，请重新登录" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: parsed.data });
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch {
    return { error: "保存失败，请稍后重试。你的修改仍保留在预览中。" };
  }
}
