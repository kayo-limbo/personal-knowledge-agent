"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { AuthShell } from "@/app/components/auth/AuthShell";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

interface LoginFormProps {
  callbackUrl: string;
  initialEmail?: string;
  registered?: boolean;
}

export function LoginForm({ callbackUrl, initialEmail = "", registered = false }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("邮箱或密码错误，请重新输入");
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("登录服务暂时不可用，请稍后再试");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="登录工作空间"
      description="继续你的 DeepSeek 对话和个人知识整理。"
      footerText="还没有账户？"
      footerLabel="创建账户"
      footerHref="/register"
    >
      {registered && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          注册成功，请使用新账户登录。
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">邮箱</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-10 pl-10"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">密码</label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
              className="h-10 pl-10"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? <><LoaderCircle className="animate-spin" />正在登录…</> : "登录"}
        </Button>
      </form>
    </AuthShell>
  );
}
