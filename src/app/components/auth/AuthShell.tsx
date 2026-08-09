import Link from "next/link";
import { BrainCircuit } from "lucide-react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footerText: string;
  footerLabel: string;
  footerHref: string;
  children: React.ReactNode;
}

/** 登录和注册共用这个紧凑外壳，确保两个页面的尺寸、间距和品牌保持一致。 */
export function AuthShell({
  eyebrow,
  title,
  description,
  footerText,
  footerLabel,
  footerHref,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f2ee] px-4 py-8 text-gray-900">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-[120%] rounded-full bg-amber-200/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 translate-x-[20%] rounded-full bg-emerald-200/45 blur-3xl" />

      <div className="relative w-full max-w-[400px]">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-950 text-white shadow-sm">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">Knowledge Agent</span>
        </Link>

        <section className="rounded-3xl border border-white/90 bg-white/85 p-6 shadow-xl shadow-gray-300/35 backdrop-blur-xl sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-6">{children}</div>
        </section>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {footerText}{" "}
          <Link href={footerHref} className="font-medium text-gray-950 underline-offset-4 hover:underline">
            {footerLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
