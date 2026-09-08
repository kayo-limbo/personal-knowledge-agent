"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateUserRole } from "@/lib/services/user.service";
import { managedUserRoleSchema } from "@/lib/validators/admin";
import { resourceIdSchema } from "@/lib/validators/common";

function usersUrl(kind: "success" | "error", message: string) {
  return `/dashboard/admin/users?${kind}=${encodeURIComponent(message)}`;
}

export async function updateUserRoleAction(formData: FormData) {
  let destination = usersUrl("success", "用户角色已更新");
  try {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    if (session.user.role !== "ADMIN") throw new Error("只有管理员可以修改用户角色");

    const userId = resourceIdSchema.parse(formData.get("id"));
    const parsed = managedUserRoleSchema.safeParse(formData.get("role"));
    if (!parsed.success) {
      destination = usersUrl("error", parsed.error.issues[0]?.message ?? "用户角色不合法");
    } else if (userId === session.user.id && parsed.data !== "ADMIN") {
      destination = usersUrl("error", "不能取消自己当前的管理员权限");
    } else {
      await updateUserRole(userId, parsed.data);
      revalidatePath("/dashboard/admin/users");
      revalidatePath("/dashboard/admin/stats");
    }
  } catch (error) {
    destination = usersUrl("error", error instanceof Error ? error.message : "更新用户角色失败");
  }
  redirect(destination);
}
