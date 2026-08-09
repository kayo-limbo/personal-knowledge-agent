import { redirect } from "next/navigation";

/**
 * 兼容旧地址，避免维护两份登录表单。
 * 项目真正的登录页是 /login，NextAuth 配置也指向该地址。
 */
export default function LegacyLoginPage() {
  redirect("/login");
}
