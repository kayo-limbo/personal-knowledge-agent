import { redirect } from "next/navigation";

/**
 * 根路径只负责导航，不承载业务页面。
 * Dashboard 自己会判断登录状态，未登录用户会继续被送到 /login。
 */
export default function HomePage() {
  redirect("/dashboard");
}
