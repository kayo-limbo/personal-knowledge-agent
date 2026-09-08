import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WorkspaceHeader from "@/app/components/dashboard/WorkspaceHeader";
import { getSystemStats } from "@/lib/services/admin-stats.service";

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>;
}

export default async function AdminStatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const stats = await getSystemStats();
  const quotaPercent = Math.min(100, Math.round((stats.activity.chatRequestsToday / stats.activity.globalChatLimit) * 100));

  return (
    <main className="space-y-6">
      <WorkspaceHeader title="系统统计" description="直接聚合 PostgreSQL 中的用户、内容、会话和今日聊天配额，不展示敏感正文。" />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="用户" value={stats.totals.users} detail={`管理员 ${stats.roles.admins} · 用户 ${stats.roles.users} · 访客 ${stats.roles.guests}`} />
        <StatCard label="知识条目" value={stats.totals.knowledge} detail="全站总量，仅管理员可见" />
        <StatCard label="Prompt" value={stats.totals.prompts} detail="所有账号创建的 Prompt" />
        <StatCard label="会话" value={stats.totals.conversations} detail={`近 7 天活跃 ${stats.activity.activeConversationsLast7Days}`} />
        <StatCard label="消息" value={stats.totals.messages} detail="用户与助手消息总量" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">今日聊天配额（UTC）</h2>
          <div className="mt-4 flex items-end justify-between"><p className="text-3xl font-bold">{stats.activity.chatRequestsToday} / {stats.activity.globalChatLimit}</p><p className="text-sm text-muted-foreground">{quotaPercent}%</p></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-gray-900" style={{ width: `${quotaPercent}%` }} /></div>
          <p className="mt-3 text-sm text-muted-foreground">今日发起聊天的账号数：{stats.activity.activeChatUsersToday}</p>
        </article>
        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">最近 7 天</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4"><div className="rounded-lg bg-gray-50 p-4"><dt className="text-sm text-muted-foreground">新增用户</dt><dd className="mt-1 text-2xl font-bold">{stats.activity.newUsersLast7Days}</dd></div><div className="rounded-lg bg-gray-50 p-4"><dt className="text-sm text-muted-foreground">活跃会话</dt><dd className="mt-1 text-2xl font-bold">{stats.activity.activeConversationsLast7Days}</dd></div></dl>
          <p className="mt-4 text-xs text-muted-foreground">这是验收版运营概览，不是完整可观测平台；不记录 Token 明细或敏感聊天正文。</p>
        </article>
      </section>
    </main>
  );
}
