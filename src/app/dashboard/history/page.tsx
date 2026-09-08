import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WorkspaceHeader from "@/app/components/dashboard/WorkspaceHeader";
import { listConversationHistory } from "@/lib/services/conversation.service";
import { deleteConversationAction, renameConversationAction } from "./actions";

interface HistoryPageProps {
  searchParams: Promise<{ query?: string; success?: string; error?: string }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "GUEST") redirect("/dashboard");

  const params = await searchParams;
  const conversations = await listConversationHistory(session.user.id, params.query);

  return (
    <main className="space-y-6">
      <WorkspaceHeader
        title="历史记录"
        description="搜索、重命名、继续或删除自己的会话，消息始终按当前用户隔离。"
      />

      {params.success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{params.success}</p>}
      {params.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>}

      <form className="flex gap-2 rounded-xl border bg-white p-4 shadow-sm" method="get">
        <input className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400" name="query" defaultValue={params.query} placeholder="按会话标题搜索" />
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white" type="submit">搜索</button>
        {params.query && <Link className="rounded-lg border px-4 py-2 text-sm font-medium" href="/dashboard/history">清除</Link>}
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">会话列表</h2>
          <span className="text-sm text-muted-foreground">最多显示最近 50 条 · 当前 {conversations.length} 条</span>
        </div>
        {conversations.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">没有匹配的会话记录。</div>
        ) : conversations.map((conversation) => {
          const preview = conversation.messages[0]?.content.replace(/\s+/g, " ").trim();
          return (
            <article key={conversation.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold">{conversation.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{preview || "暂无有效消息"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {conversation._count.messages} 条消息 · 更新于 {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(conversation.updatedAt)}
                  </p>
                </div>
                <Link className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-gray-700" href={`/dashboard/chat?conversation=${encodeURIComponent(conversation.id)}`}>
                  继续对话
                </Link>
              </div>
              <div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-[1fr_auto]">
                <form action={renameConversationAction} className="flex gap-2">
                  <input type="hidden" name="id" value={conversation.id} />
                  <input className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" name="title" defaultValue={conversation.title} maxLength={80} required aria-label="新会话标题" />
                  <button className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50" type="submit">重命名</button>
                </form>
                <details className="text-sm">
                  <summary className="cursor-pointer rounded-lg px-3 py-2 text-red-600">删除</summary>
                  <form action={deleteConversationAction} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="id" value={conversation.id} />
                    <span className="text-xs text-muted-foreground">消息会一并删除</span>
                    <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white" type="submit">确认</button>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
