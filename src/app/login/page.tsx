import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "登录 | Personal Knowledge Agent" };

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; registered?: string; email?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl, registered, email } = await searchParams;
  // 只接受站内路径，避免攻击者把登录后的用户跳转到钓鱼网站。
  const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard";
  return (
    <LoginForm
      callbackUrl={safeCallbackUrl}
      initialEmail={email ?? ""}
      registered={registered === "1"}
    />
  );
}
